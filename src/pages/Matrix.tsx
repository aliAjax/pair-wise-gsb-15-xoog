import {useMemo,useState} from 'react';
import {Lock,Plus,Send,ShieldCheck,Trash2,Users} from 'lucide-react';
import {PageTitle,Status} from '../components/common';
import {useAppStore} from '../store/useAppStore';
import {useMatrixStore} from '../store/useMatrixStore';
import {fmtAmount} from '../domain/matrixValidation';
import {users} from '../../mock-data/catalog';
import type {ApprovalRule} from '../types';
const kindLabel={overlap:'区间重叠',cycle:'代理成环',departed:'离职未交接'} as const;
const rangeText=(r:ApprovalRule)=>`${fmtAmount(r.min)} – ${fmtAmount(r.max??Infinity)}`;
export function Matrix(){
 const m=useMatrixStore();
 const workflows=useAppStore(s=>s.workflows);
 const instances=useAppStore(s=>s.instances);
 const latest=m.published[m.published.length-1];
 const [reason,setReason]=useState('');
 const nodeOptions=useMemo(()=>{const seen=new Map<string,string>();workflows.forEach(w=>w.nodes.filter(n=>n.type==='approval').forEach(n=>{if(!seen.has(n.data.label))seen.set(n.data.label,n.id)}));return [...seen.entries()].map(([label,id])=>({label,id}))},[workflows]);
 const runValidate=()=>{const c=m.validateDraft();useAppStore.setState({toast:c.length?`发现 ${c.length} 项冲突`:'校验通过，可以发布'})};
 const createDraft=()=>{m.createDraft(reason.trim());setReason('')};
 const addRule=()=>{if(!m.draft)return;const first=nodeOptions[0];m.updateDraftRules([...m.draft.rules,{id:'r-'+Date.now(),nodeId:first?.id||'approval',nodeLabel:first?.label||'审批节点',role:'部门负责人',min:0,max:1000,delegate:users[0]}])};
 const updateRule=(i:number,rule:ApprovalRule)=>{if(!m.draft)return;m.updateDraftRules(m.draft.rules.map((r,k)=>k===i?rule:r))};
 const removeRule=(i:number)=>{if(!m.draft)return;m.updateDraftRules(m.draft.rules.filter((_,k)=>k!==i))};
 return <div className="page">
  <PageTitle eyebrow="权限与代理" title="Approval Matrix" desc="按审批节点登记角色、金额区间与代理审批人；发布后冻结快照，实例按发起时的版本读取。"/>
  <div className="matrix-status">
   <article><small>当前生效版本</small><b>v{latest.version} · 已冻结</b></article>
   <article><small>调整草稿</small><b>{m.draft?`基于 v${m.draft.basedOn} 编辑中`:'无草稿'}</b></article>
   <article><small>代理链</small><b>{Object.keys(m.delegations).length} 条代理关系</b></article>
   <article><small>离职角色</small><b>{m.roles.filter(r=>r.departed).length} 个待交接</b></article>
  </div>
  {m.conflicts.length>0&&<section className="panel conflicts" data-testid="matrix-conflicts">
   <div className="panel-head"><div><h2>发布被阻止：{m.conflicts.length} 项冲突</h2><p>逐条解决节点、角色与冲突区间问题后才能发布</p></div></div>
   {m.conflicts.map((c,i)=><div className="conflict-row" data-testid="conflict-item" key={i}>
    <span className={'conflict-kind '+c.kind}>{kindLabel[c.kind]}</span>
    <div className="grow"><b>{c.message}</b><small>节点：{c.nodeLabels.join('、')} · 角色：{c.roles.join('、')}{c.range&&` · 冲突区间：${fmtAmount(c.range.min)} – ${fmtAmount(c.range.max??Infinity)}`}{c.chain&&` · 代理环：${[...c.chain,c.chain[0]].join(' → ')}`}</small></div>
   </div>)}
  </section>}
  {!m.draft&&<section className="panel" data-testid="draft-create">
   <div className="panel-head"><div><h2>调整审批矩阵</h2><p>已发布快照不可修改，任何调整都必须新建带原因的草稿</p></div></div>
   <div className="draft-create-body">
    <input data-testid="draft-reason" aria-label="调整原因" placeholder="调整原因（必填），例如：三季度额度调整" value={reason} onChange={e=>setReason(e.target.value)}/>
    <button data-testid="create-draft" disabled={!reason.trim()} onClick={createDraft}><Plus/>新建调整草稿</button>
   </div>
  </section>}
  {m.draft&&<section className="panel draft-editor" data-testid="matrix-draft">
   <div className="panel-head"><div><h2>调整草稿 · 基于 v{m.draft.basedOn}</h2><p>原因：{m.draft.reason} · 创建于 {m.draft.createdAt}</p></div>
    <div className="draft-actions">
     <button className="secondary" data-testid="add-rule" onClick={addRule}><Plus/>新增规则</button>
     <button className="secondary" data-testid="validate-matrix" onClick={runValidate}><ShieldCheck/>运行校验</button>
     <button data-testid="publish-matrix" onClick={()=>m.publishDraft()}><Send/>发布矩阵</button>
     <button className="secondary" data-testid="discard-draft" onClick={m.discardDraft}><Trash2/>放弃草稿</button>
    </div></div>
   <table><thead><tr><th>审批节点</th><th>角色</th><th>金额下限</th><th>金额上限</th><th>代理审批人</th><th></th></tr></thead>
    <tbody>{m.draft.rules.map((r,i)=><tr key={r.id} data-testid={`rule-row-${i}`}>
     <td><select aria-label="审批节点" value={r.nodeLabel} onChange={e=>{const opt=nodeOptions.find(o=>o.label===e.target.value);updateRule(i,{...r,nodeLabel:e.target.value,nodeId:opt?.id||r.nodeId})}}>{nodeOptions.map(o=><option key={o.label} value={o.label}>{o.label}</option>)}</select></td>
     <td><select aria-label="审批角色" value={r.role} onChange={e=>updateRule(i,{...r,role:e.target.value})}>{m.roles.map(x=><option key={x.name} value={x.name}>{x.name}{x.departed?'（已离职）':''}</option>)}</select></td>
     <td><input aria-label="金额下限" type="number" value={r.min} onChange={e=>updateRule(i,{...r,min:Number(e.target.value)})}/></td>
     <td><input aria-label="金额上限" type="number" placeholder="无上限" value={r.max??''} onChange={e=>updateRule(i,{...r,max:e.target.value===''?null:Number(e.target.value)})}/></td>
     <td><select aria-label="代理审批人" value={r.delegate} onChange={e=>updateRule(i,{...r,delegate:e.target.value})}>{users.map(u=><option key={u}>{u}</option>)}</select></td>
     <td><button className="icon-btn" aria-label="删除规则" onClick={()=>removeRule(i)}><Trash2/></button></td>
    </tr>)}</tbody></table>
  </section>}
  <section className="panel" data-testid="matrix-snapshots">
   <div className="panel-head"><div><h2>已发布快照</h2><p>发布后冻结只读，运行中的实例继续读取其发起时的版本</p></div></div>
   {[...m.published].reverse().map(v=><div className="snapshot" data-testid={`snapshot-v${v.version}`} key={v.version}>
    <div className="snapshot-head"><b>v{v.version}</b><span className="frozen"><Lock/>已冻结</span>{v.version===latest.version&&<em>当前生效</em>}<small>{v.publishedAt} · {v.reason}</small></div>
    <table><thead><tr><th>审批节点</th><th>角色</th><th>金额区间</th><th>代理审批人</th></tr></thead>
     <tbody>{v.rules.map(r=><tr key={r.id}><td>{r.nodeLabel}</td><td>{r.role}</td><td>{rangeText(r)}</td><td>{r.delegate}</td></tr>)}</tbody></table>
   </div>)}
  </section>
  <section className="panel" data-testid="role-directory">
   <div className="panel-head"><div><h2>角色目录</h2><p>离职角色必须指定交接人，否则引用它的规则不得发布</p></div></div>
   <div className="role-list">{m.roles.map(r=><div className="role-row" data-testid={`role-${r.name}`} key={r.name}>
    <Users/><b>{r.name}</b>
    {r.departed?<span className="status abnormal">已离职</span>:<span className="status published">在职</span>}
    {r.departed&&(r.successor?<small>已交接给 {r.successor}</small>:<select className="handover" aria-label={`交接人-${r.name}`} defaultValue="" onChange={e=>e.target.value&&m.setSuccessor(r.name,e.target.value)}><option value="" disabled>指定交接人…</option>{users.map(u=><option key={u}>{u}</option>)}</select>)}
   </div>)}</div>
  </section>
  <section className="panel" data-testid="instance-snapshots">
   <div className="panel-head"><div><h2>实例快照对应</h2><p>运行中的实例继续读取旧快照，新发起实例使用当前 v{latest.version}</p></div>
    <button data-testid="new-instance" onClick={m.newInstance}><Plus/>模拟发起新实例</button></div>
   <table><thead><tr><th>实例编号</th><th>申请人</th><th>状态</th><th>矩阵快照</th></tr></thead>
    <tbody>
     {m.extraInstances.map(i=><tr key={i.id} data-testid="instance-snapshot-row"><td><b>{i.id}</b></td><td>{i.applicant}</td><td><Status value={i.status}/></td><td><span className="snapshot-tag">v{i.matrixVersion} 快照</span></td></tr>)}
     {instances.slice(0,6).map(i=><tr key={i.id} data-testid="instance-snapshot-row"><td><b>{i.id}</b></td><td>{i.applicant}</td><td><Status value={i.status}/></td><td><span className="snapshot-tag">v{m.instanceMatrix[i.id]??1} 快照</span></td></tr>)}
    </tbody></table>
  </section>
 </div>;
}
