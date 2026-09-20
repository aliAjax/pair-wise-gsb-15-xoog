import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {matrixSeed} from '../../mock-data/matrix';
import {delegations as delegationSeed,roleDirectory,users} from '../../mock-data/catalog';
import {validateMatrix} from '../domain/matrixValidation';
import {useAppStore} from './useAppStore';
import type {ApprovalRule,MatrixConflict,MatrixDraft,MatrixInstance,MatrixVersion,RoleInfo} from '../types';
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const now=()=>new Date().toLocaleString('zh-CN',{hour12:false});
const latestOf=(p:MatrixVersion[])=>p[p.length-1];
const toast=(msg:string)=>useAppStore.setState({toast:msg});
interface MatrixState{published:MatrixVersion[];draft:MatrixDraft|null;roles:RoleInfo[];delegations:Record<string,string>;instanceMatrix:Record<string,number>;extraInstances:MatrixInstance[];conflicts:MatrixConflict[];createDraft:(reason:string)=>void;updateDraftRules:(rules:ApprovalRule[])=>void;discardDraft:()=>void;validateDraft:()=>MatrixConflict[];publishDraft:()=>boolean;setSuccessor:(role:string,user:string)=>void;newInstance:()=>void}
export const useMatrixStore=create<MatrixState>()(persist((set,get)=>({
 published:clone(matrixSeed),
 draft:null,
 roles:clone(roleDirectory),
 delegations:{...delegationSeed},
 instanceMatrix:{},
 extraInstances:[],
 conflicts:[],
 createDraft:reason=>{const latest=latestOf(get().published);set({draft:{basedOn:latest.version,reason,createdAt:now(),rules:clone(latest.rules)},conflicts:[]});toast(`已基于 v${latest.version} 创建调整草稿`)},
 updateDraftRules:rules=>set(s=>({draft:s.draft?{...s.draft,rules}:s.draft})),
 discardDraft:()=>{set({draft:null,conflicts:[]});toast('已放弃矩阵草稿')},
 validateDraft:()=>{const s=get();if(!s.draft)return[];const conflicts=validateMatrix(s.draft.rules,s.roles,s.delegations);set({conflicts});return conflicts},
 publishDraft:()=>{const s=get();if(!s.draft)return false;const conflicts=get().validateDraft();if(conflicts.length){toast(`存在 ${conflicts.length} 项冲突，无法发布`);return false}const v=latestOf(s.published).version+1;set({published:[...s.published,{version:v,publishedAt:now(),reason:s.draft.reason,rules:clone(s.draft.rules)}],draft:null,conflicts:[]});toast(`审批矩阵 v${v} 发布成功，权限快照已冻结`);return true},
 setSuccessor:(role,user)=>{set(s=>({roles:s.roles.map(r=>r.name===role?{...r,successor:user}:r)}));toast(`「${role}」已交接给 ${user}`)},
 newInstance:()=>{const s=get();const v=latestOf(s.published).version;const id=`INS-2026-${9001+s.extraInstances.length}`;const ins:MatrixInstance={id,workflowName:'差旅费用审批',applicant:users[s.extraInstances.length%users.length],status:'running',matrixVersion:v,createdAt:now()};set({extraInstances:[ins,...s.extraInstances],instanceMatrix:{...s.instanceMatrix,[id]:v}});toast(`实例 ${id} 已按矩阵 v${v} 发起`)},
}),{name:'flowdesk-matrix',version:1}));
