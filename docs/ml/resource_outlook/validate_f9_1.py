"""Read-only artifact validation; regeneration writes only to a temporary directory."""
import importlib.util
import json
import shutil
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import lightgbm as lgb

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'ml/resource_outlook'
E = BASE / 'electricity_recent'


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    datasets = []
    for path, date, target in [
        (BASE/'maharashtra_daily_demand_clean.csv', 'date', 'peak_met_mw'),
        (E/'maharashtra_daily_sldc_2024_2026.csv', 'date', 'state_peak_met_mw'),
        (E/'maharashtra_daily_combined_2013_2026.csv', 'date', 'peak_met_mw'),
        (BASE/'water/bhatsa_weekly_2022_2025_cwc.csv', 'expected_date', 'live_storage_mcm'),
        (BASE/'water/bhatsa_weekly_continuous_calendar.csv', 'expected_date', 'live_storage_mcm'),
        (BASE/'water/bhatsa_lake_storage_daily.csv', 'date', 'live_storage_mcm'),
    ]:
        df = pd.read_csv(path)
        if date not in df:
            datasets.append({'file':path.name, 'columns':list(df.columns)})
            continue
        d = pd.to_datetime(df[date], errors='raise')
        v = pd.to_numeric(df[target], errors='raise')
        datasets.append(dict(file=path.name, start=str(d.min().date()), end=str(d.max().date()), rows=len(df), valid=int(v.notna().sum()), null=int(v.isna().sum()), duplicates=int(d.duplicated().sum()), negative=int((v<0).sum()), ordered=bool(d.is_monotonic_increasing), calendar_days=int((d.max()-d.min()).days+1)))
    print('DATASETS', json.dumps(datasets))
    c = pd.read_csv(E/'electricity_model_comparison_v3.csv')
    obs = pd.read_csv(E/'maharashtra_daily_combined_2013_2026.csv').set_index('date').peak_met_mw
    assert np.allclose(c.y_true_mw, c.date.map(obs))
    lag_dates = (pd.to_datetime(c.date)-pd.Timedelta(days=364)).dt.strftime('%Y-%m-%d')
    assert np.allclose(c.pred_seasonal_naive_mw, lag_dates.map(obs))
    assert (lag_dates <= c.origin_date).all()
    cols = ['pred_seasonal_naive_mw','pred_trend_adjusted_mw','pred_regularized_lgb_mw']
    def metrics(frame):
        return {col:dict(n=len(frame), mae=float(abs(frame.y_true_mw-frame[col]).mean()), mape=float((abs(frame.y_true_mw-frame[col])/frame.y_true_mw).mean()*100)) for col in cols}
    print('WINDOWS', json.dumps({org:metrics(g) for org,g in c.groupby('origin_date')}))
    print('POOLED',json.dumps(metrics(c)))
    calibration=c[c.origin_date<='2024-10-31']; evaluation=c[c.origin_date>'2024-10-31']
    q=np.percentile(calibration.y_true_mw-calibration.pred_seasonal_naive_mw,[10,90])
    r=evaluation.y_true_mw-evaluation.pred_seasonal_naive_mw
    covered=int(((r>=q[0]) & (r<=q[1])).sum())
    print('INTERVAL',json.dumps(dict(calibration=len(calibration),evaluation=len(evaluation),offsets=q.tolist(),covered=covered,coverage=covered/len(evaluation)*100)))
    fc=pd.read_csv(E/'electricity_forecast_26w_2026_2027.csv')
    a=pd.read_csv(E/'electricity_forecast_26w_source_audit.csv')
    assert len(fc)==182 and pd.to_datetime(fc.forecast_date).equals(pd.Series(pd.date_range('2026-10-28',periods=182)))
    assert (a.source_observation_date<='2026-10-27').all()
    assert np.allclose(a.source_observed_peak_mw,a.source_observation_date.map(obs))
    assert np.allclose(fc.predicted_peak_met_mw,a.final_predicted_peak_met_mw)
    assert ((fc.p10_lower_bound_mw<=fc.predicted_peak_met_mw)&(fc.predicted_peak_met_mw<=fc.p90_upper_bound_mw)).all()
    print('FORECAST',json.dumps(dict(primary=int(a.is_primary_lag_observed.sum()),fallback=int((~a.is_primary_lag_observed).sum()),max=float(fc.predicted_peak_met_mw.max()),upper=float(fc.p90_upper_bound_mw.max()))))
    with tempfile.TemporaryDirectory(prefix='ecosite-f9-1-') as directory:
        temp=Path(directory)
        shutil.copy(E/'electricity_evaluation_metrics_v3.json',temp)
        mod=load_module('finalize',E/'finalize_forecast_and_audit.py')
        mod.ELECTRO_DIR=temp; mod.METRICS_PATH=temp/'electricity_evaluation_metrics_v3.json'
        mod.run_finalize()
        for filename in ['electricity_forecast_26w_2026_2027.csv','electricity_forecast_26w_source_audit.csv']:
            assert (temp/filename).read_bytes()==(E/filename).read_bytes(), filename
        print('REGENERATION byte-identical forecast and source audit')
    model=lgb.Booster(model_file=str(BASE/'models/v3/lgbm_demand_production_v3.txt'))
    trainer=load_module('trainer',E/'train_and_evaluate_electricity_v3.py')
    data=trainer.load_data(); climo=trainer.get_static_climatology()
    features=pd.DataFrame([trainer.extract_features(d,'2026-10-27',data,climo) for d in fc.forecast_date])
    pred=model.predict(features[model.feature_name()])
    assert np.isfinite(pred).all()
    print('MODEL',json.dumps(dict(trees=model.num_trees(),features=model.feature_name(),delta_range=[float(pred.min()),float(pred.max())])))
    water=load_module('water',BASE/'water/evaluate_water_readiness_v3.py')
    with tempfile.TemporaryDirectory(prefix='ecosite-water-f9-1-') as directory:
        water.WATER_DIR=Path(directory)
        water.run_water_readiness_assessment()
        result=json.loads((Path(directory)/'water_evaluation_metrics_v3.json').read_text())
        print('WATER_METRICS',json.dumps(result['historical_backtest_evaluations']))
        assert (Path(directory)/'bhatsa_illustrative_scenarios_2026_2027.csv').read_bytes()==(BASE/'water/bhatsa_illustrative_scenarios_2026_2027.csv').read_bytes()
    print('ALL ARTIFACT ASSERTIONS PASSED')


if __name__ == '__main__':
    main()
