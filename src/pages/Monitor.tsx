import {useMemo,useState} from 'react';import {useSearchParams} from 'react-router-dom';import {Activity,AlertTriangle,Clock,Search,Snowflake,X} from 'lucide-react';
import {Empty,PageTitle,Status} from '../components/common';
import {FlowCanvas} from '../components/FlowCanvas';
import {useAppStore} from '../store/useAppStore';
import {resolveSnapshot} from '../domain/validation';

export function Monitor(){
 const ins=useAppStore(s=>s.instances),ws=useAppStore(s=>s.workflows),[params]=useSearchParams();
 const [filter,setFilter]=useState('all'),[q,setQ]=useState(''),[selected,setSelected]=useState<string|null>(params.get('instance'));
 const rows=useMemo(()=>ins.filter(i=>(filter==='all'||i.status===filter)&&(i.id.toLowerCase().includes(q.toLowerCase())||i.applicant.includes(q))),[ins,filter,q]);
 const item=ins.find(i=>i.id===selected),flow=ws.find(w=>w.id===item?.workflowId);
 const roles=useAppStore(s=>s.roles);
 const snapshot=item&&flow?resolveSnapshot(flow,item.snapshotVersion,roles):null;
 const latest=flow?[...flow.versions].sort((a,b)=>b.version-a.version)[0]:null;
 return <div className="page"><PageTitle eyebrow="运行中心" title="Runtime Monitor" desc="实例在发起时锁定权限快照版本；后续矩阵发布不影响运行中的实例。"/>
 <section className="monitor-kpis">{[['运行中',ins.filter(i=>i.status==='running').length,Activity],['异常',ins.filter(i=>i.status==='abnormal').length,AlertTriangle],['超时',ins.filter(i=>i.status==='timeout').length,Clock],['今日完成',ins.filter(i=>i.status==='completed').length,Activity]].map(([a,b,I]:any)=><article key={a}><I/><span><small>{a}</small><b>{b}</b></span></article>)}</section>
 <div className="toolbar panel"><div className="search"><Search/><input aria-label="搜索实例" value={q} onChange={e=>setQ(e.target.value)} placeholder="搜索实例编号或申请人"/></div>{[['all','全部'],['abnormal','异常'],['timeout','超时'],['running','进行中'],['completed','已完成']].map(([v,l])=><button key={v} className={'filter '+(filter===v?'active':'')} onClick={()=>setFilter(v)}>{l}</button>)}</div>
 <section className="panel monitor-table">{rows.length?<table><thead><tr><th>实例编号</th><th>申请人</th><th>业务域</th><th>当前节点</th><th>状态</th><th>快照版本</th><th>提交时间</th><th>耗时</th><th>风险</th></tr></thead><tbody>{rows.map(i=><tr key={i.id} data-testid="instance-row" onClick={()=>setSelected(i.id)}><td><b>{i.id}</b></td><td>{i.applicant}</td><td>{i.domain}</td><td>{i.currentNode}</td><td><Status value={i.status}/></td><td><span className="snapshot-badge" data-testid="snapshot-badge"><Snowflake width={11}/>v{i.snapshotVersion||'-'}</span></td><td>{i.submittedAt}</td><td>{i.duration}</td><td><Status value={i.risk}/></td></tr>)}</tbody></table>:<Empty title="没有匹配的实例"/>}</section>
 {item&&flow&&snapshot&&<div className="drawer-backdrop"><aside className="instance-drawer" data-testid="instance-detail"><div className="drawer-head"><div><small>流程实例详情</small><h2>{item.id}</h2></div><button className="icon-btn" onClick={()=>setSelected(null)}><X/></button></div>
  <div className="detail-meta"><div><small>申请人</small><b>{item.applicant}</b></div><div><small>状态</small><Status value={item.status}/></div><div><small>耗时</small><b>{item.duration}</b></div><div><small>风险</small><Status value={item.risk}/></div></div>
  <div className="snapshot-strip" data-testid="snapshot-strip"><Snowflake/><div><b>读取权限快照 v{snapshot.version}</b><small>{snapshot.createdAt} · {snapshot.note}</small></div>{latest&&latest.version!==snapshot.version&&<span className="status draft">线上已到 v{latest.version}，本实例继续读旧快照</span>}</div>
  <h3>执行流程（快照 v{snapshot.version} 画布）</h3><div className="runtime-canvas"><FlowCanvas nodes={snapshot.nodes} edges={snapshot.edges} onNodes={()=>{}} onEdges={()=>{}} onSelect={()=>{}} highlight={snapshot.nodes.find(n=>n.data.label===item.currentNode)?.id} readOnly/></div>
  <h3>快照审批矩阵（{snapshot.matrix.length} 条）</h3><div className="snapshot-matrix">{snapshot.matrix.length?snapshot.matrix.map(m=><div key={m.nodeId} className="snap-row"><b>{m.nodeLabel}</b><span>{m.role}</span><small>{m.range.min===0?'¥0':`¥${m.range.min.toLocaleString()}`} ~ {m.range.max===null?'封顶':`¥${m.range.max.toLocaleString()}`}</small><em>代理：{m.delegateRole}</em></div>):<small className="missing">该快照无审批节点</small>}</div>
  <h3>执行时间线</h3><div className="timeline" data-testid="execution-timeline">{item.timeline.map((t,k)=><div key={k} className={t.status}><i/><span><b>{t.title}</b><small>{t.time}</small></span><Status value={t.status==='current'?'running':t.status==='pending'?'archived':'completed'}/></div>)}</div>
 </aside></div>}
 </div>;
}
