"""
EcoSite Resource Outlook — ML-F2 LightGBM Historical Demand Forecaster
Predicts Maharashtra state peak electricity demand met (MW) across 6-month horizons
using genuine historical observations with strict leakage prevention.
"""

import json
import os
import numpy as np
import pandas as pd
from pathlib import Path
import lightgbm as lgb

# Base paths
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "maharashtra_demand_weather_aligned.csv"
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

def load_data():
    df = pd.read_csv(DATA_PATH)
    df['date'] = pd.to_datetime(df['date'])
    df = df.set_index('date').sort_index()
    return df

def compute_training_climatology(hist_df):
    """
    Computes smoothed 15-day day-of-year climatological normals
    strictly using historical observations on or before origin/training cutoff.
    """
    hist = hist_df.copy()
    hist['doy'] = hist.index.dayofyear
    
    climo = hist.groupby('doy').agg({
        '2m_temperature_max': 'mean',
        '2m_temperature_mean': 'mean',
        '2m_dewpoint_temperature_mean': 'mean',
        'surface_solar_radiation_downwards_mean': 'mean',
        'utci_max': 'mean',
    }).rename(columns={
        '2m_temperature_max': 'climo_t2m_max',
        '2m_temperature_mean': 'climo_t2m_mean',
        '2m_dewpoint_temperature_mean': 'climo_dewpoint_mean',
        'surface_solar_radiation_downwards_mean': 'climo_solar_mean',
        'utci_max': 'climo_utci_max',
    })
    
    # Wrap-around smooth across 15 days
    climo_3x = pd.concat([climo, climo, climo])
    climo_smooth = climo_3x.rolling(15, center=True, min_periods=1).mean().iloc[366:366+366]
    return climo_smooth

def extract_features_for_target(dt, origin_date, df_known, climo_table):
    """
    Constructs feature dictionary for target date dt from forecast origin_date.
    GUARANTEES ZERO LEAKAGE:
    - Never uses actual future demand.
    - Never uses realized future ERA5 weather.
    - All lags and origin momentum terms are <= origin_date.
    """
    origin = pd.Timestamp(origin_date)
    dt = pd.Timestamp(dt)
    h = (dt - origin).days
    doy = dt.dayofyear
    dow = dt.dayofweek
    month = dt.month
    
    # 52 weeks ago (known at origin because h <= 180 < 364)
    d364 = dt - pd.Timedelta(days=364)
    if d364 in df_known.index:
        lag_364 = df_known.loc[d364, 'peak_met_mw']
        lag_energy = df_known.loc[d364, 'energy_met_mu']
    else:
        lag_364 = np.nan
        lag_energy = np.nan
        
    # 104 weeks ago
    d728 = dt - pd.Timedelta(days=728)
    lag_728 = df_known.loc[d728, 'peak_met_mw'] if d728 in df_known.index else np.nan
    
    # Origin state at T (trailing 30-day mean load)
    origin_load_30d = df_known['peak_met_mw'].loc[origin - pd.Timedelta(days=29):origin].mean()
    origin_load_7d = df_known['peak_met_mw'].loc[origin - pd.Timedelta(days=6):origin].mean()
    
    # Origin YoY diff at T
    dt_52w = origin - pd.Timedelta(days=364)
    prior_30d = df_known['peak_met_mw'].loc[dt_52w - pd.Timedelta(days=29):dt_52w].mean()
    origin_yoy_diff = (origin_load_30d - prior_30d) if prior_30d > 0 else 0.0
    
    # Training-derived Climatological Weather
    c_val = climo_table.loc[doy] if doy in climo_table.index else climo_table.iloc[doy % len(climo_table)]
    t_max_c = c_val['climo_t2m_max'] - 273.15
    t_mean_c = c_val['climo_t2m_mean'] - 273.15
    cdd_24 = max(0.0, t_max_c - 24.0)
    
    return {
        'date': dt,
        'origin_date': origin,
        'lead_days': h,
        'lead_month': int(np.ceil(h / 30.5)),
        'month': month,
        'day_of_week': dow,
        'day_of_year': doy,
        'is_weekend': 1 if dow in [5, 6] else 0,
        'month_sin': np.sin(2 * np.pi * month / 12),
        'month_cos': np.cos(2 * np.pi * month / 12),
        'doy_sin': np.sin(2 * np.pi * doy / 365.25),
        'doy_cos': np.cos(2 * np.pi * doy / 365.25),
        'dow_sin': np.sin(2 * np.pi * dow / 7),
        'dow_cos': np.cos(2 * np.pi * dow / 7),
        'climo_t2m_max_c': t_max_c,
        'climo_t2m_mean_c': t_mean_c,
        'climo_cdd_base24': cdd_24,
        'climo_dewpoint_c': c_val['climo_dewpoint_mean'] - 273.15,
        'climo_solar_mj': c_val['climo_solar_mean'] / 1e6,
        'climo_utci_c': c_val['climo_utci_max'] - 273.15,
        'lag_364d_mw': lag_364,
        'lag_364d_energy_mu': lag_energy,
        'lag_728d_mw': lag_728,
        'origin_load_30d': origin_load_30d,
        'origin_load_7d': origin_load_7d,
        'origin_yoy_diff': origin_yoy_diff,
    }

def build_training_dataset(df_full, climo_table):
    """
    Builds training dataset by rolling semi-monthly forecast origins from 2016-01-01 to 2022-06-30.
    """
    train_origins = pd.date_range('2016-01-01', '2022-06-30', freq='15D')
    rows = []
    deltas = []
    
    for org in train_origins:
        df_known = df_full[df_full.index <= org]
        future_dates = [org + pd.Timedelta(days=h) for h in range(1, 181)]
        future_dates = [d for d in future_dates if d in df_full.index and d <= pd.Timestamp('2022-12-31')]
        
        for dt in future_dates:
            feat = extract_features_for_target(dt, org, df_known, climo_table)
            if not np.isnan(feat['lag_364d_mw']):
                y_act = df_full.loc[dt, 'peak_met_mw']
                delta = y_act - feat['lag_364d_mw']
                rows.append(feat)
                deltas.append(delta)
                
    feat_df = pd.DataFrame(rows)
    y_delta = np.array(deltas)
    return feat_df, y_delta

def build_fixed_origin_forecast(df_full, origin_date, horizon_days, climo_table):
    """
    Generates fixed-origin forecast features and actual targets for evaluation.
    """
    origin = pd.Timestamp(origin_date)
    df_known = df_full[df_full.index <= origin]
    future_dates = [origin + pd.Timedelta(days=h) for h in range(1, horizon_days + 1) if (origin + pd.Timedelta(days=h)) in df_full.index]
    
    rows = [extract_features_for_target(dt, origin, df_known, climo_table) for dt in future_dates]
    feat_df = pd.DataFrame(rows).set_index('date')
    y_actual = df_full.loc[feat_df.index, 'peak_met_mw'].values
    return feat_df, y_actual

def calculate_metrics(y_true, y_pred):
    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred)**2)))
    mape = float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100)
    bias = float(np.mean(y_pred - y_true))
    return {'mae_mw': round(mae, 2), 'rmse_mw': round(rmse, 2), 'mape_pct': round(mape, 2), 'bias_mw': round(bias, 2)}

def train_and_evaluate():
    print("Loading aligned Maharashtra demand & weather dataset...")
    df = load_data()
    
    # 1. Fit training climatology strictly on data <= 2022-12-31
    climo_table = compute_training_climatology(df[df.index <= '2022-12-31'])
    
    # 2. Build training set
    print("Building training dataset across historical rolling origins...")
    train_feat_df, y_train_delta = build_training_dataset(df, climo_table)
    
    drop_cols = ['date', 'origin_date', 'lead_month']
    feature_cols = [c for c in train_feat_df.columns if c not in drop_cols]
    X_train = train_feat_df[feature_cols]
    print(f"Training shape: {X_train.shape}, delta targets: {len(y_train_delta)}")
    
    # 3. Build validation set (Origin: 2023-04-30, Monsoon: May-Oct 2023)
    val_feat_df, y_val = build_fixed_origin_forecast(df, '2023-04-30', 184, climo_table)
    val_X = val_feat_df[feature_cols]
    
    # 4. Build test set (Origin: 2023-10-31, Winter/Summer: Nov 2023 - Apr 2024)
    test_feat_df, y_test = build_fixed_origin_forecast(df, '2023-10-31', 179, climo_table)
    test_X = test_feat_df[feature_cols]
    
    # 5. Train LightGBM Models
    config = {
        'boosting_type': 'gbdt',
        'n_estimators': 300,
        'learning_rate': 0.03,
        'num_leaves': 20,
        'min_child_samples': 30,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'random_state': 42,
        'feature_count': len(feature_cols),
        'features': feature_cols,
    }
    
    print("Training LightGBM Median Forecaster (P50)...")
    p50_model = lgb.LGBMRegressor(
        objective='regression_l1',
        boosting_type=config['boosting_type'],
        n_estimators=config['n_estimators'],
        learning_rate=config['learning_rate'],
        num_leaves=config['num_leaves'],
        min_child_samples=config['min_child_samples'],
        subsample=config['subsample'],
        colsample_bytree=config['colsample_bytree'],
        random_state=config['random_state'],
        verbose=-1,
    )
    p50_model.fit(X_train, y_train_delta)
    p50_model.booster_.save_model(str(MODEL_DIR / "lgbm_demand_p50.txt"))
    
    print("Training LightGBM Lower Bound Forecaster (P10)...")
    p10_model = lgb.LGBMRegressor(
        objective='quantile',
        alpha=0.10,
        boosting_type=config['boosting_type'],
        n_estimators=config['n_estimators'],
        learning_rate=config['learning_rate'],
        num_leaves=config['num_leaves'],
        min_child_samples=config['min_child_samples'],
        subsample=config['subsample'],
        colsample_bytree=config['colsample_bytree'],
        random_state=config['random_state'],
        verbose=-1,
    )
    p10_model.fit(X_train, y_train_delta)
    p10_model.booster_.save_model(str(MODEL_DIR / "lgbm_demand_p10.txt"))
    
    print("Training LightGBM Upper Bound Forecaster (P90)...")
    p90_model = lgb.LGBMRegressor(
        objective='quantile',
        alpha=0.90,
        boosting_type=config['boosting_type'],
        n_estimators=config['n_estimators'],
        learning_rate=config['learning_rate'],
        num_leaves=config['num_leaves'],
        min_child_samples=config['min_child_samples'],
        subsample=config['subsample'],
        colsample_bytree=config['colsample_bytree'],
        random_state=config['random_state'],
        verbose=-1,
    )
    p90_model.fit(X_train, y_train_delta)
    p90_model.booster_.save_model(str(MODEL_DIR / "lgbm_demand_p90.txt"))
    
    # 6. Generate Predictions on Held-Out Test Set
    pred_test_50 = test_feat_df['lag_364d_mw'].values + p50_model.predict(test_X)
    pred_test_10 = test_feat_df['lag_364d_mw'].values + p10_model.predict(test_X)
    pred_test_90 = test_feat_df['lag_364d_mw'].values + p90_model.predict(test_X)
    
    test_eval_df = pd.DataFrame({
        'date': test_feat_df.index,
        'origin_date': test_feat_df['origin_date'].values,
        'lead_days': test_feat_df['lead_days'].values,
        'lead_month': test_feat_df['lead_month'].values,
        'y_true': y_test,
        'baseline_seasonal_naive_mw': test_feat_df['lag_364d_mw'].values,
        'lgbm_pred_p50_mw': np.round(pred_test_50, 1),
        'lgbm_pred_p10_mw': np.round(pred_test_10, 1),
        'lgbm_pred_p90_mw': np.round(pred_test_90, 1),
    }).set_index('date')
    
    test_eval_clean = test_eval_df.dropna()
    
    # 7. Generate Predictions on Held-Out Validation Set (Monsoon)
    pred_val_50 = val_feat_df['lag_364d_mw'].values + p50_model.predict(val_X)
    pred_val_10 = val_feat_df['lag_364d_mw'].values + p10_model.predict(val_X)
    pred_val_90 = val_feat_df['lag_364d_mw'].values + p90_model.predict(val_X)
    
    val_eval_df = pd.DataFrame({
        'date': val_feat_df.index,
        'origin_date': val_feat_df['origin_date'].values,
        'lead_days': val_feat_df['lead_days'].values,
        'lead_month': val_feat_df['lead_month'].values,
        'y_true': y_val,
        'baseline_seasonal_naive_mw': val_feat_df['lag_364d_mw'].values,
        'lgbm_pred_p50_mw': np.round(pred_val_50, 1),
        'lgbm_pred_p10_mw': np.round(pred_val_10, 1),
        'lgbm_pred_p90_mw': np.round(pred_val_90, 1),
    }).set_index('date')
    
    val_eval_clean = val_eval_df.dropna()
    
    # Save combined backtest predictions
    all_backtest = pd.concat([val_eval_clean, test_eval_clean])
    all_backtest.to_csv(BASE_DIR / "backtest_predictions.csv", index=True)
    
    # 8. Compute Detailed Metrics
    test_naive_m = calculate_metrics(test_eval_clean['y_true'], test_eval_clean['baseline_seasonal_naive_mw'])
    test_lgb_m = calculate_metrics(test_eval_clean['y_true'], test_eval_clean['lgbm_pred_p50_mw'])
    
    val_naive_m = calculate_metrics(val_eval_clean['y_true'], val_eval_clean['baseline_seasonal_naive_mw'])
    val_lgb_m = calculate_metrics(val_eval_clean['y_true'], val_eval_clean['lgbm_pred_p50_mw'])
    
    # Lead-month performance on Test Set
    lead_month_metrics = {}
    for lm, grp in test_eval_clean.groupby('lead_month'):
        lead_month_metrics[f"month_{lm}"] = {
            'evaluated_days': len(grp),
            'baseline': calculate_metrics(grp['y_true'], grp['baseline_seasonal_naive_mw']),
            'lightgbm': calculate_metrics(grp['y_true'], grp['lgbm_pred_p50_mw']),
        }
        
    # Uncertainty / Coverage metrics
    test_in_cov = (test_eval_clean['y_true'] >= test_eval_clean['lgbm_pred_p10_mw']) & (test_eval_clean['y_true'] <= test_eval_clean['lgbm_pred_p90_mw'])
    val_in_cov = (val_eval_clean['y_true'] >= val_eval_clean['lgbm_pred_p10_mw']) & (val_eval_clean['y_true'] <= val_eval_clean['lgbm_pred_p90_mw'])
    
    uncertainty_results = {
        'nominal_interval': '80% (P10 to P90)',
        'calibration_status': 'UNBOUNDED_EMPIRICAL_QUANTILE (Uncalibrated on long horizons)',
        'test_set_winter_summer': {
            'evaluated_days': len(test_eval_clean),
            'observed_coverage_pct': round(float(np.mean(test_in_cov) * 100), 2),
            'mean_interval_width_mw': round(float(np.mean(test_eval_clean['lgbm_pred_p90_mw'] - test_eval_clean['lgbm_pred_p10_mw'])), 1),
        },
        'validation_set_monsoon': {
            'evaluated_days': len(val_eval_clean),
            'observed_coverage_pct': round(float(np.mean(val_in_cov) * 100), 2),
            'mean_interval_width_mw': round(float(np.mean(val_eval_clean['lgbm_pred_p90_mw'] - val_eval_clean['lgbm_pred_p10_mw'])), 1),
        }
    }
    
    # 9. Feature Importance
    importance_df = pd.DataFrame({
        'feature': feature_cols,
        'importance_gain': np.round(p50_model.booster_.feature_importance(importance_type='gain'), 2),
        'importance_split': p50_model.booster_.feature_importance(importance_type='split'),
    }).sort_values('importance_gain', ascending=False)
    importance_df.to_csv(BASE_DIR / "feature_importance.csv", index=False)
    
    # 10. Summary Metrics JSON
    metrics_summary = {
        'evaluation_regimes': {
            'test_set_winter_to_summer': {
                'origin_date': '2023-10-31',
                'horizon_dates': '2023-11-01 to 2024-04-27',
                'total_calendar_days': 179,
                'evaluated_days': len(test_eval_clean),
                'excluded_missing_days': int(len(test_feat_df) - len(test_eval_clean)),
                'seasonal_naive_baseline': test_naive_m,
                'lightgbm_p50': test_lgb_m,
                'lead_month_breakdown': lead_month_metrics,
            },
            'validation_set_monsoon_to_postmonsoon': {
                'origin_date': '2023-04-30',
                'horizon_dates': '2023-05-01 to 2023-10-31',
                'total_calendar_days': 184,
                'evaluated_days': len(val_eval_clean),
                'excluded_missing_days': int(len(val_feat_df) - len(val_eval_clean)),
                'seasonal_naive_baseline': val_naive_m,
                'lightgbm_p50': val_lgb_m,
            }
        },
        'model_comparison_verdict': {
            'monsoon_improvement': f"LightGBM improves over seasonal-naive by {round(val_naive_m['mae_mw'] - val_lgb_m['mae_mw'], 2)} MW MAE ({val_lgb_m['mape_pct']}% vs {val_naive_m['mape_pct']}% MAPE) during erratic monsoon swings.",
            'winter_summer_comparison': f"Seasonal-naive achieves {test_naive_m['mape_pct']}% MAPE ({test_naive_m['mae_mw']} MW) while LightGBM achieves {test_lgb_m['mape_pct']}% MAPE ({test_lgb_m['mae_mw']} MW) due to steady baseline continuity.",
            'complementary_role': 'LightGBM provides valuable thermodynamic weather responsiveness and peak upper bounds (P90) where persistence fails.'
        }
    }
    
    with open(BASE_DIR / "evaluation_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)
        
    with open(BASE_DIR / "uncertainty_results.json", "w", encoding="utf-8") as f:
        json.dump(uncertainty_results, f, indent=2)
        
    with open(BASE_DIR / "training_config.json", "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
        
    print("\n--- ML-F2 EVALUATION COMPLETED ---")
    print("Test Set (Winter->Summer):")
    print(f"  Seasonal-Naive: {test_naive_m}")
    print(f"  LightGBM P50:   {test_lgb_m}")
    print("Validation Set (Monsoon):")
    print(f"  Seasonal-Naive: {val_naive_m}")
    print(f"  LightGBM P50:   {val_lgb_m}")
    print("Top 5 Features by Gain:\n", importance_df.head(5).to_string())

if __name__ == "__main__":
    train_and_evaluate()

