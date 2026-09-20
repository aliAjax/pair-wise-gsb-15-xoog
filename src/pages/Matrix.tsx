import {useMemo} from 'react';import {useNavigate,useParams} from 'react-router-dom';import {ArrowLeft,GitBranch,ShieldAlert,Snowflake,Users} from 'lucide-react';
import {PageTitle} from '../components/common';
import {useAppStore} from '../store/useAppStore';
import {checkApprovalMatrix,rangeText} from '../domain/validation';
import type {Role,ValidationIssue} from '../types';

function ConflictRow({issue,w,onFix}:{issue:ValidationIssue;w:any;onFix:(nodeId:string)=>void}){
 const node=w.nodes.find((n:any)=>n.id===issue.nodeId);
 const conflict=issue.conflictNodeId?w.nodes.find((n:any)=>n.id===issue.conflictNodeId):undefined;
 const detail=[
  issue.role?`角色：${issue.role}`:'',
  issue.range?`区间：${rangeText(issue.range)}${issue.conflictRange?` × ${rangeText(issue.conflictRange)}`:''}`:'',
  issue.chain?`代理链：${issue.chain.join(' → ')}`:'',
 ].filter(Boolean).join(' · ');
 return <button data-testid={'conflict-'+(issue.kind||'x')} className={'conflict conflict-'+issue.level} onClick={()=>onFix(issue.nodeId)}>
  <b>{issue.message}</b>
  <small>节点：{node?.data.label||'-'}{conflict?` · 冲突节点：${conflict.data.label}`:''}</small>
  {detail&&<small><em>{detail}</em></small>}
  <span>去修复 →</span>
 </button>;
}

export function Matrix(){
 const {id}=useParams(),nav=useNavigate(),store=useAppStore();
 const w=store.workflows.find(x=>x.id===id)!;
 const locked=w.status==='published'||w.status==='archived';
 const {issues,matrix}=useMemo(()=>checkApprovalMatrix(w.nodes,store.roles),[w.nodes,store.roles]);
 const errors=issues.filter(i=>i.level==='error'),warnings=issues.filter(i=>i.level==='warning');
 const latest=[...w.versions].sort((a,b)=>b.version-a.version)[0];
 const approvalNodes=w.nodes.filter(n=>n.type==='approval');
 const fix=(nodeId:string)=>{store.setCurrent(w.id);store.selectNode(nodeId);nav(`/workflows/${w.id}`);};
 const indicator=locked
  ?<span className="frozen-indicator">已冻结 v{w.version}</span>
  :w.status==='adjusting'?<span className="adjust-indicator">调整草稿 · 基于 v{w.baseVersion}</span>:<span className="draft-indicator">草稿</span>;
 return <div className="page matrix-page">
  <button className="back-link" onClick={()=>nav(`/workflows/${id}`)}><ArrowLeft/>返回编辑器</button>
  <PageTitle eyebrow="审批矩阵 / Approval Matrix" title={`${w.name} · 审批矩阵`} desc="每个审批节点登记审批角色、金额区间与代理审批人；区间重叠、代理成环或角色离职未交接时不得发布。" actions={<>{indicator}<button data-testid="matrix-validate" onClick={()=>{store.setCurrent(w.id);store.requestValidation();nav(`/workflows/${w.id}`)}}>前往编辑器校验</button></>}/>

  <section className="panel matrix-section" data-testid="matrix-table">
   <div className="panel-head"><div><h2>审批节点登记（{locked?'冻结快照 · 只读':'当前草稿'}）</h2><p>同一审批角色的金额区间不允许重叠</p></div></div>
   <table>
    <thead><tr><th>审批节点</th><th>审批角色</th><th>金额区间</th><th>代理审批人</th><th>登记状态</th></tr></thead>
    <tbody>
     {approvalNodes.map(n=>{
      const c=n.data.config,entry=matrix.find(m=>m.nodeId===n.id);
      const nodeIssues=issues.filter(i=>i.nodeId===n.id);
      return <tr key={n.id} data-testid="matrix-row">
       <td><b>{n.data.label}</b></td>
       <td>{c.role?<span className="role-chip">{c.role}</span>:<span className="missing">未登记</span>}</td>
       <td>{entry&&c.max!==undefined?rangeText(entry.range):<span className="missing">区间无效</span>}</td>
       <td>{c.delegateRole?<span className="delegate-cell"><GitBranch width={12}/>{c.delegateRole}</span>:<span className="missing">未登记</span>}</td>
       <td>{nodeIssues.length?nodeIssues.map(i=><span key={i.message} className={'status '+(i.level==='error'?'abnormal':'medium')}>{i.level==='error'?'阻断':'警告'}</span>):<span className="status completed">完整</span>}</td>
      </tr>;
     })}
     {!approvalNodes.length&&<tr><td colSpan={5} style={{textAlign:'center',color:'#8b938f'}}>该流程没有审批节点</td></tr>}
    </tbody>
   </table>
  </section>

  <div className="matrix-grid">
   <section className="panel matrix-section" data-testid="conflict-panel">
    <div className="panel-head"><div><h2><ShieldAlert/>发布阻断清单</h2><p>{errors.length?`${errors.length} 个阻断问题必须先修复，${warnings.length} 个警告`:warnings.length?`${warnings.length} 个警告（不阻断发布）`:''}</p></div></div>
    <div className="conflict-list">
     {errors.length===0&&warnings.length===0&&<div className="conflict-ok">✓ 无区间重叠、无代理成环、角色均已交接，可以发布</div>}
     {issues.map((i,k)=><ConflictRow key={k} issue={i} w={w} onFix={fix}/>)}
    </div>
   </section>

   <section className="panel matrix-section" data-testid="role-directory">
    <div className="panel-head"><div><h2><Users/>角色目录与交接</h2><p>离职角色必须登记交接人，否则相关节点不得发布</p></div></div>
    <div className="role-list">
     {store.roles.map((r:Role)=><div key={r.id} className={'role-row '+r.status}>
      <div><b>{r.name}</b><span className={'status '+r.status}>{r.status==='active'?'在职':'已离职'}</span></div>
      {r.status==='departed'&&<label>交接给
       <select aria-label={`${r.name} 交接人`} value={r.handoverTo||''} onChange={e=>store.setRoleHandover(r.id,e.target.value)}>
        <option value="">未交接（阻断发布）</option>
        {store.roles.filter(x=>x.status==='active').map(x=><option key={x.id} value={x.name}>{x.name}</option>)}
       </select>
      </label>}
      {r.status==='active'&&r.handoverTo&&<small>临时代管：{r.handoverTo}</small>}
     </div>)}
    </div>
   </section>
  </div>

  {latest&&<section className="panel matrix-section snapshot-section" data-testid="snapshot-panel">
   <div className="panel-head"><div><h2><Snowflake/>线上冻结快照 v{latest.version}</h2><p>{latest.createdAt} 发布 · {latest.note} · 运行中的实例持续读取该快照</p></div></div>
   <div className="snapshot-roles"><small>快照角色目录：</small>{latest.roles.map(r=><span key={r.id} className={'status '+r.status}>{r.name}{r.status==='departed'?`（离职${r.handoverTo?'→'+r.handoverTo:'·未交接'}）`:''}</span>)}</div>
   <table>
    <thead><tr><th>快照节点</th><th>角色</th><th>冻结金额区间</th><th>冻结代理审批人</th></tr></thead>
    <tbody>{latest.matrix.map(m=><tr key={m.nodeId}><td><b>{m.nodeLabel}</b></td><td>{m.role}</td><td>{rangeText(m.range)}</td><td>{m.delegateRole}</td></tr>)}
     {!latest.matrix.length&&<tr><td colSpan={4} style={{textAlign:'center',color:'#8b938f'}}>该快照没有审批节点</td></tr>}
    </tbody>
   </table>
  </section>}
 </div>;
}
