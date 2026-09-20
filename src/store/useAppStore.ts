import {create} from 'zustand';
import {workflows as seed} from '../../mock-data/workflows';
import {instances as instanceSeed} from '../../mock-data/instances';
import {roles as roleSeed} from '../../mock-data/catalog';
import {extractMatrix, validateWorkflow} from '../domain/validation';
import type {FlowEdge,FlowNode,Instance,Role,ValidationIssue,Workflow} from '../types';

const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const STORAGE_KEY='flowdesk-state-v2';
const now=()=>{const d=new Date(),p=(x:number)=>String(x).padStart(2,'0');return `2026-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
const editable=(s:WorkflowStatus)=>s==='draft'||s==='adjusting';
type WorkflowStatus=Workflow['status'];

interface Persisted{workflows:Workflow[];instances:Instance[];roles:Role[]}
const hydrate=():Persisted=>{
 try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const p=JSON.parse(raw) as Persisted;if(Array.isArray(p.workflows)&&Array.isArray(p.roles))return p;}}catch{/* 数据损坏时回退种子 */}
 return {workflows:clone(seed),instances:clone(instanceSeed),roles:clone(roleSeed)};
};
const initial=hydrate();

interface State extends Persisted{
 currentId:string;selectedNodeId:string|null;issues:ValidationIssue[];toast:string;pendingValidate:boolean;
 setCurrent:(id:string)=>void;selectNode:(id:string|null)=>void;
 requestValidation:()=>void;clearPendingValidate:()=>void;
 updateNodes:(nodes:FlowNode[])=>void;updateEdges:(edges:FlowEdge[])=>void;
 updateConfig:(id:string,config:Record<string,any>)=>void;
 runValidation:()=>ValidationIssue[];
 save:()=>void;publish:()=>boolean;
 startAdjustment:(reason:string)=>void;
 create:()=>string;copy:(id:string)=>void;archive:(id:string)=>void;
 restore:(v:number,reason?:string)=>void;
 launchInstance:(workflowId:string,values:Record<string,string>)=>string|null;
 setRoleHandover:(roleId:string,handoverTo:string)=>void;
 resetDemoData:()=>void;clearToast:()=>void;
}

export const useAppStore=create<State>((set,get)=>({
 ...initial,
 currentId:'wf-1',selectedNodeId:null,issues:[],toast:'',pendingValidate:false,

 setCurrent:id=>set({currentId:id,selectedNodeId:null,issues:[]}),
 selectNode:id=>set({selectedNodeId:id}),
 requestValidation:()=>set({pendingValidate:true}),
 clearPendingValidate:()=>set({pendingValidate:false}),

 /* 已发布 / 已归档流程的画布与配置冻结，所有编辑入口对非草稿状态静默拒绝 */
 updateNodes:nodes=>set(s=>{const w=s.workflows.find(x=>x.id===s.currentId);if(!w||!editable(w.status))return {};return{workflows:s.workflows.map(x=>x.id===s.currentId?{...x,nodes}:x)}}),
 updateEdges:edges=>set(s=>{const w=s.workflows.find(x=>x.id===s.currentId);if(!w||!editable(w.status))return {};return{workflows:s.workflows.map(x=>x.id===s.currentId?{...x,edges}:x)}}),
 updateConfig:(id,config)=>set(s=>{const w=s.workflows.find(x=>x.id===s.currentId);if(!w||!editable(w.status))return {};return{workflows:s.workflows.map(x=>x.id===s.currentId?{...x,nodes:x.nodes.map(n=>n.id===id?{...n,data:{...n.data,config:{...n.data.config,...config},state:'configuring'}}:n)}:x)}}),

 runValidation:()=>{
  const w=get().workflows.find(x=>x.id===get().currentId)!;
  const issues=validateWorkflow(w,get().roles);
  set(s=>({issues,workflows:s.workflows.map(x=>x.id===w.id?{...x,nodes:x.nodes.map(n=>({...n,data:{...n.data,state:issues.some(i=>i.nodeId===n.id)?'invalid':'valid'}}))}:x),toast:issues.filter(i=>i.level==='error').length?`发现 ${issues.filter(i=>i.level==='error').length} 个阻断问题、${issues.filter(i=>i.level==='warning').length} 个警告`:'校验通过，可以发布'}));
  return issues;
 },

 save:()=>set(s=>{
  const w=s.workflows.find(x=>x.id===s.currentId)!;
  if(!editable(w.status))return {toast:'已发布版本已冻结，如需调整请先新建调整草稿'};
  return {workflows:s.workflows.map(x=>x.id===w.id?{...x,updatedAt:now()}:x),toast:w.status==='adjusting'?`调整草稿已保存（原因：${w.draftReason}）`:'草稿已保存'};
 }),

 /* 发布：校验通过后冻结权限快照（矩阵 + 角色目录），写入新版本；调整草稿发布后转正 */
 publish:()=>{
  const w=get().workflows.find(x=>x.id===get().currentId)!;
  const issues=validateWorkflow(w,get().roles);
  const errors=issues.filter(i=>i.level==='error');
  set({issues,workflows:get().workflows.map(x=>x.id===w.id?{...x,nodes:x.nodes.map(n=>({...n,data:{...n.data,state:issues.some(i=>i.nodeId===n.id)?'invalid':'valid'}}))}:x)});
  if(errors.length){set({toast:`存在 ${errors.length} 个发布阻断问题，无法发布`});return false;}
  const version=w.version+1,ts=now();
  const note=w.status==='adjusting'?`调整草稿发布：${w.draftReason}`:'发布最新审批配置';
  set(s=>({workflows:s.workflows.map(x=>x.id===w.id?{
   ...x,status:'published',version,publishedAt:ts,updatedAt:ts,baseVersion:undefined,draftReason:undefined,
   versions:[...x.versions,{version,createdAt:ts,note,nodes:clone(x.nodes),edges:clone(x.edges),matrix:extractMatrix(x.nodes),roles:clone(s.roles)}],
  }:x),toast:`发布成功，权限快照 v${version} 已冻结`}));
  return true;
 },

 /* 已发布流程不允许就地修改：必须新建带原因的调整草稿；运行中的实例不受影响 */
 startAdjustment:reason=>set(s=>{
  const w=s.workflows.find(x=>x.id===s.currentId)!;
  if(editable(w.status))return {toast:'当前已经是草稿状态，可直接编辑'};
  if(!reason.trim())return {toast:'必须填写调整原因才能新建草稿'};
  return {workflows:s.workflows.map(x=>x.id===w.id?{...x,status:'adjusting',baseVersion:x.version,draftReason:reason.trim(),updatedAt:now()}:x),issues:[],selectedNodeId:null,toast:`已基于 v${w.version} 创建调整草稿，请记录原因：${reason.trim()}`};
 }),

 create:()=>{const id='wf-'+Date.now();set(s=>({workflows:[{id,name:'未命名流程',domain:'财务',status:'draft',version:0,editor:'林秋',updatedAt:now(),abnormalCount:0,nodes:[],edges:[],versions:[]},...s.workflows],currentId:id,issues:[]}));return id;},
 copy:id=>set(s=>{const w=s.workflows.find(x=>x.id===id)!;return{workflows:[{...clone(w),id:'wf-'+Date.now(),name:w.name+'（副本）',status:'draft',baseVersion:undefined,draftReason:undefined},...s.workflows]}}),
 archive:id=>set(s=>({workflows:s.workflows.map(w=>w.id===id?{...w,status:'archived'}:w)})),

 restore:(v,reason)=>set(s=>{
  const w=s.workflows.find(x=>x.id===s.currentId)!;
  const old=w.versions.find(x=>x.version===v)!;
  if(!old)return {};
  if(w.version>0&&!reason?.trim())return {toast:'流程已发布过，恢复历史版本需要填写原因并生成调整草稿'};
  const publishedBefore=w.versions.length>0;
  return {workflows:s.workflows.map(x=>{
   if(x.id!==w.id)return x;
   return {...x,status:publishedBefore?'adjusting':'draft',nodes:clone(old.nodes),edges:clone(old.edges),baseVersion:publishedBefore?x.version:undefined,draftReason:publishedBefore?reason!.trim():undefined,updatedAt:now()};
  }),toast:publishedBefore?`已基于 v${v} 创建调整草稿（原因：${reason!.trim()}）`:`已恢复 v${v} 为草稿`};
 }),

 /* 新建实例：锁定到当前最新已发布快照版本；从未发布成功的流程不允许发起 */
 launchInstance:(workflowId,values)=>{
  const w=get().workflows.find(x=>x.id===workflowId)!;
  const latest=[...w.versions].sort((a,b)=>b.version-a.version)[0];
  if(!latest){set({toast:'流程尚未发布成功，不能发起实例'});return null;}
  const seq=get().instances.length+1;
  const id=`INS-2026-${String(seq).padStart(4,'0')}`;
  const first=latest.nodes.find(n=>n.type!=='start');
  const inst:Instance={id,workflowId,applicant:'林秋',domain:w.domain,currentNode:first?.data.label||'开始',status:'running',submittedAt:now().slice(5),duration:'0h 0m',risk:'low',snapshotVersion:latest.version,timeline:[
   {title:'提交申请',time:now().slice(11),status:'completed'},
   ...(first?[{title:first.data.label,time:'待派发',status:'current' as const}]:[]),
  ]};
  set(s=>({instances:[inst,...s.instances],toast:`实例 ${id} 已发起，权限快照 v${latest.version}（金额 ¥${Number(values.amount||0).toLocaleString()}）`}));
  return id;
 },

 /* 角色交接：写入角色目录；已冻结的历史快照不受影响，仅新草稿校验/新发布快照生效 */
 setRoleHandover:(roleId,handoverTo)=>set(s=>({roles:s.roles.map(r=>r.id===roleId?{...r,handoverTo:handoverTo||undefined}:r),toast:handoverTo?'角色交接已登记：后续发布的快照将生效':'已清除交接人'})),

 resetDemoData:()=>{const fresh={workflows:clone(seed),instances:clone(instanceSeed),roles:clone(roleSeed)};set({...fresh,currentId:'wf-1',selectedNodeId:null,issues:[],toast:'演示数据已重置'});},
 clearToast:()=>set({toast:''}),
}));

/* 矩阵 / 草稿 / 实例快照整体持久化：刷新页面后仍互相对应 */
useAppStore.subscribe(s=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify({workflows:s.workflows,instances:s.instances,roles:s.roles}));}catch{/* 存储不可用时忽略 */}});
