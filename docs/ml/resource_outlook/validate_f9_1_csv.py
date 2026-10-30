"""Independent CSV checks; no dependencies, no source artifact writes."""
import csv, json, math, statistics
from pathlib import Path
from datetime import date, timedelta
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[3]
B=ROOT/'ml/resource_outlook'; E=B/'electricity_recent'; W=B/'water'
def rows(p):
    with p.open(encoding='utf-8-sig',newline='') as f: return list(csv.DictReader(f))
def val(x): return float(x) if x else None
def quantile(x,p):
    x=sorted(x); k=(len(x)-1)*p; i=int(k)
    return x[i]+(x[min(i+1,len(x)-1)]-x[i])*(k-i)
def metric(rs,col):
    errors=[abs(float(r['y_true_mw'])-float(r[col])) for r in rs]
    return dict(n=len(rs),mae=statistics.mean(errors),mape=statistics.mean(e/float(r['y_true_mw'])*100 for e,r in zip(errors,rs)))
result={'datasets':[]}
for p,dt,target in [(B/'maharashtra_daily_demand_clean.csv','date','peak_met_mw'),(E/'maharashtra_daily_sldc_2024_2026.csv','date','state_peak_met_mw'),(E/'maharashtra_daily_combined_2013_2026.csv','date','peak_met_mw'),(W/'bhatsa_weekly_2022_2025_cwc.csv','expected_date','live_storage_mcm'),(W/'bhatsa_weekly_continuous_calendar.csv','expected_date','live_storage_mcm'),(W/'bhatsa_lake_storage_daily.csv','observation_date','live_storage_mcm')]:
    rs=rows(p); ds=[date.fromisoformat(r[dt]) for r in rs]; vs=[val(r[target]) for r in rs]
    result['datasets'].append(dict(file=p.name,start=str(min(ds)),end=str(max(ds)),rows=len(rs),valid=sum(v is not None for v in vs),null=sum(v is None for v in vs),duplicates=len(ds)-len(set(ds)),negative=sum(v is not None and v<0 for v in vs),ordered=ds==sorted(ds),calendar_days=(max(ds)-min(ds)).days+1))
obs={r['date']:val(r['peak_met_mw']) for r in rows(E/'maharashtra_daily_combined_2013_2026.csv')}
c=rows(E/'electricity_model_comparison_v3.csv'); groups=defaultdict(list)
cols=['pred_seasonal_naive_mw','pred_trend_adjusted_mw','pred_regularized_lgb_mw']
for r in c:
    assert float(r['y_true_mw'])==obs[r['date']]
    lag=str(date.fromisoformat(r['date'])-timedelta(days=364))
    assert float(r[cols[0]])==obs[lag] and lag<=r['origin_date']
    groups[r['origin_date']].append(r)
result['windows']={o:{col:metric(rs,col) for col in cols} for o,rs in groups.items()}
result['pooled']={col:metric(c,col) for col in cols}
result['macro']={col:{m:statistics.mean(result['windows'][o][col][m] for o in groups) for m in ['mae','mape']} for col in cols}
cal=[r for r in c if r['origin_date']<='2024-10-31']; ev=[r for r in c if r['origin_date']>'2024-10-31']
res=[float(r['y_true_mw'])-float(r[cols[0]]) for r in cal]; lo,hi=quantile(res,.1),quantile(res,.9)
n=sum(lo<=float(r['y_true_mw'])-float(r[cols[0]])<=hi for r in ev)
result['interval']=dict(calibration=len(cal),evaluation=len(ev),covered=n,coverage=n/len(ev)*100,offsets=[lo,hi])
f=rows(E/'electricity_forecast_26w_2026_2027.csv'); a=rows(E/'electricity_forecast_26w_source_audit.csv')
assert len(f)==len(a)==182
trend=statistics.mean(v for d,v in obs.items() if '2025-10-28'<=d<='2026-10-27' and v is not None)-statistics.mean(v for d,v in obs.items() if '2024-10-29'<=d<='2025-10-27' and v is not None)
for i,(r,s) in enumerate(zip(f,a),1):
    assert r['forecast_date']==str(date(2026,10,27)+timedelta(days=i))
    assert s['source_observation_date']<='2026-10-27'
    v=obs[s['source_observation_date']]; assert v==float(s['source_observed_peak_mw'])
    d=date.fromisoformat(r['forecast_date']); lag=str(d-timedelta(days=364))
    if obs.get(lag) is not None: pred=obs[lag]; assert s['source_observation_date']==lag
    else: pred=obs[str(d-timedelta(days=728))]+trend
    assert round(pred,1)==float(r['predicted_peak_met_mw'])==float(s['final_predicted_peak_met_mw'])
    assert round(pred+lo,1)==float(r['p10_lower_bound_mw'])
    assert round(pred+hi,1)==float(r['p90_upper_bound_mw'])
    assert float(r['p10_lower_bound_mw'])<=pred<=float(r['p90_upper_bound_mw'])
result['forecast']=dict(records=len(f),primary=sum(r['is_primary_lag_observed']=='True' for r in a),max=max(float(r['predicted_peak_met_mw']) for r in f),upper=max(float(r['p90_upper_bound_mw']) for r in f),independent_formula_reproduction='all 182 points and intervals match')
w=rows(W/'bhatsa_weekly_2022_2025_cwc.csv'); wd={r['expected_date']:val(r['live_storage_mcm']) for r in w}; wm={}
for start,end in [('2024-01-04','2024-06-27'),('2024-07-04','2024-12-26'),('2025-01-02','2025-05-01')]:
    org=date.fromisoformat(start)-timedelta(days=7); prev=str(org-timedelta(days=364)); shift=(wd[str(org)]-wd[prev]) if wd.get(str(org)) is not None and wd.get(prev) is not None else 0
    pairs=[]; dt=date.fromisoformat(start)
    while str(dt)<=end:
        actual=wd.get(str(dt)); lag=wd.get(str(dt-timedelta(days=364)))
        if actual is not None and lag is not None: pairs.append((actual,lag))
        dt+=timedelta(days=7)
    wm[start]=dict(n=len(pairs),naive_mae=statistics.mean(abs(y-p) for y,p in pairs),naive_mape=statistics.mean(abs(y-p)/y*100 for y,p in pairs),trend_mae=statistics.mean(abs(y-max(0,min(942.1,p+shift))) for y,p in pairs),trend_mape=statistics.mean(abs(y-max(0,min(942.1,p+shift)))/y*100 for y,p in pairs))
result['water_metrics']=wm
result['water_distinct_observations']=len({r['observation_date'] for r in w if r['live_storage_mcm']})
result['raw_cwc_manifest_entries']=sum(k.startswith('cwc_bulletin') for k in json.loads((W/'raw/water_raw_sources_manifest.json').read_text()))
assert all(r['classification']=='ILLUSTRATIVE_SCENARIO_ONLY' for r in rows(W/'bhatsa_illustrative_scenarios_2026_2027.csv'))
print(json.dumps(result,indent=2))
