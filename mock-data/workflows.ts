import type {FlowEdge,FlowNode,Role,Version,Workflow,WorkflowStatus} from '../src/types';
import {roles as roleSeed} from './catalog';
import {extractMatrix} from '../src/domain/validation';

const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const n=(id:string,type:FlowNode['type'],x:number,y:number,label:string,config:Record<string,any>={}):FlowNode=>({id,type,position:{x,y},data:{label,state:Object.keys(config).length?'valid':'unconfigured',config}});

const approvalConfig={approverSource:'固定角色',role:'部门负责人',min:0,max:null,delegateRole:'HRBP',instruction:'请确认申请内容与预算归属'};

const standard=(broken=false)=>{
 const nodes=[n('start','start',20,150,'开始',{ok:true}),n('form','form',210,150,'提交申请',{fields:[{id:'reason',label:'申请说明',type:'text',required:true},{id:'amount',label:'申请金额',type:'amount',required:true},{id:'attachment',label:'附件',type:'attachment',required:false}]}),n('approval','approval',420,150,'直属主管审批',approvalConfig),n('condition','condition',630,150,'金额判断',broken?{}:{ruleType:'amount',operator:'>',value:5000}),n('notify','notify',850,40,'高额通知',{targets:'财务审批人',template:'高额申请提醒',timing:'分支进入时'}),n('automation','automation',850,260,'记录系统',{action:'写入系统记录'}),n('end','end',1070,150,'结束',{ok:true})];
 const edges:FlowEdge[]=[['start','form'],['form','approval'],['approval','condition'],['condition','notify','大于 5,000'],['condition','automation','其他'],['notify','end'],['automation','end']].map((e,i)=>({id:'e'+i,source:e[0],target:e[1],label:e[2]})); return {nodes,edges};
};

/** 审批矩阵冲突演示：同角色区间重叠 + 代理成环 + 离职角色未交接（三类发布阻断同时存在） */
const matrixConflict=()=>{
 const ap=(id:string,x:number,label:string,role:string,min:number,max:number|null,delegateRole:string)=>
   n(id,'approval',x,230,label,{approverSource:'固定角色',role,min,max,delegateRole,instruction:'矩阵冲突演示节点'});
 const nodes=[
  n('start','start',20,230,'开始',{ok:true}),
  n('form','form',200,230,'提交申请',{fields:[{id:'amount',label:'申请金额',type:'amount',required:true}]}),
  ap('ap-1',400,'小额财务审批','财务审批人',0,5000,'采购专员'),
  ap('ap-2',600,'中额财务审批','财务审批人',3000,20000,'采购专员'),
  ap('ap-3',800,'采购复核','采购专员',0,10000,'财务审批人'),
  ap('ap-4',1000,'行政大额审批','行政主管',50000,null,'系统管理员'),
  n('end','end',1200,230,'结束',{ok:true}),
 ];
 const chain=['start','form','ap-1','ap-2','ap-3','ap-4','end'];
 const edges:FlowEdge[]=chain.slice(0,-1).map((s,i)=>({id:'me'+i,source:s,target:chain[i+1]}));
 return {nodes,edges};
};

const names=['差旅费用审批','采购合同审批','员工入职流程','IT 服务请求','用印申请','供应商准入','年度预算调整','客户退款审批','法务审查流程','资产领用审批','营销活动报备','跨区域大型采购及多部门联合审批流程（集团特别管控版）'];

export const workflows:Workflow[]=names.map((name,i)=>{
 const graph=i===11?matrixConflict():standard(i===0||i===3);
 if(i!==11){
  if(i===8) graph.nodes=graph.nodes.filter(x=>x.type!=='end');
  if(i===9) graph.nodes.push(n('orphan','approval',650,390,'孤立审批',{}));
 }
 const rawStatus=i%4===0?'draft':i%5===0?'archived':'published';
 const status:WorkflowStatus=i===11?'draft':rawStatus;
 const oldNodes=i===11?[]:graph.nodes.filter(x=>x.id!=='notify').map(x=>({...x,data:{...x.data}}));
 const oldEdges=i===11?[]:graph.edges.filter(e=>e.source!=='notify'&&e.target!=='notify');
 const publishedAt=status==='published'?'2026-07-08 14:30':undefined;
 const snapshot=(vs:number,nodes:FlowNode[],edges:FlowEdge[],createdAt:string,note:string):Version=>({version:vs,createdAt,note,nodes,edges,matrix:extractMatrix(nodes),roles:clone(roleSeed)});
 const versions:Version[]=i===11?[]:[
  snapshot(1,oldNodes,oldEdges,'2026-06-12 10:00','初始化流程结构'),
  snapshot(2,graph.nodes,graph.edges,'2026-07-01 16:20','增加金额分支与通知节点'),
 ];
 return {id:'wf-'+(i+1),name,domain:['财务','采购','人力资源','IT服务','法务'][i%5],status,version:versions.at(-1)?.version||0,editor:['林秋','陈默','周礼','王宁'][i%4],updatedAt:`2026-07-${String(10-i%9).padStart(2,'0')} ${9+i%8}:20`,publishedAt,abnormalCount:i===7?0:i%4,nodes:graph.nodes,edges:graph.edges,versions};
});

export {roleSeed as roles};
export type {Role};
