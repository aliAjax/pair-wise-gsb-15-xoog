import type {ApprovalRule,MatrixConflict,RoleInfo} from '../types';
const HI=Number.POSITIVE_INFINITY;
const hi=(r:ApprovalRule)=>r.max??HI;
export const fmtAmount=(n:number)=>!isFinite(n)?'无上限':'¥'+n.toLocaleString('zh-CN');
export function findOverlaps(rules:ApprovalRule[]):MatrixConflict[]{
 const out:MatrixConflict[]=[];
 for(let i=0;i<rules.length;i++)for(let j=i+1;j<rules.length;j++){
  const a=rules[i],b=rules[j];
  if(a.role!==b.role)continue;
  const lo=Math.max(a.min,b.min),up=Math.min(hi(a),hi(b));
  if(lo<up)out.push({kind:'overlap',nodeIds:[a.nodeId,b.nodeId],nodeLabels:[a.nodeLabel,b.nodeLabel],roles:[a.role],range:{min:lo,max:up===HI?null:up},message:`金额区间重叠：角色「${a.role}」在「${a.nodeLabel}」与「${b.nodeLabel}」的区间 ${fmtAmount(lo)} – ${fmtAmount(up)} 重叠`});
 }
 return out;
}
export function detectCycles(map:Record<string,string>):string[][]{
 const cycles:string[][]=[],state:Record<string,number>={};
 for(const start of Object.keys(map)){
  if(state[start])continue;
  const path:string[]=[];let cur:string|undefined=start;
  while(cur&&map[cur]!==undefined&&!state[cur]){state[cur]=1;path.push(cur);cur=map[cur];}
  if(cur&&state[cur]===1)cycles.push(path.slice(path.indexOf(cur)));
  for(const p of path)state[p]=2;
 }
 return cycles;
}
export function findDelegateCycles(rules:ApprovalRule[],delegations:Record<string,string>):MatrixConflict[]{
 return detectCycles(delegations).flatMap(chain=>{
  const hit=rules.filter(r=>chain.includes(r.delegate));
  if(!hit.length)return[];
  const loop=[...chain,chain[0]].join(' → ');
  return [{kind:'cycle' as const,nodeIds:hit.map(r=>r.nodeId),nodeLabels:hit.map(r=>r.nodeLabel),roles:[...new Set(hit.map(r=>r.role))],chain,message:`代理链成环：${loop}（节点「${hit.map(r=>r.nodeLabel).join('、')}」的代理审批人处于环中）`}];
 });
}
export function findDeparted(rules:ApprovalRule[],roles:RoleInfo[]):MatrixConflict[]{
 return rules.filter(r=>{const role=roles.find(x=>x.name===r.role);return role?.departed&&!role.successor}).map(r=>({kind:'departed' as const,nodeIds:[r.nodeId],nodeLabels:[r.nodeLabel],roles:[r.role],message:`角色已离职且未交接：「${r.role}」（节点「${r.nodeLabel}」）`}));
}
export function validateMatrix(rules:ApprovalRule[],roles:RoleInfo[],delegations:Record<string,string>):MatrixConflict[]{
 return [...findOverlaps(rules),...findDelegateCycles(rules,delegations),...findDeparted(rules,roles)];
}
