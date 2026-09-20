import type {Instance} from '../src/types';
import {domains,users} from './catalog';

/**
 * 实例在创建时锁定快照版本：
 * - wf-2 的实例全部停留在 v1（v2 已增加「高额通知」节点，但运行中的实例继续读取旧快照）
 * - 其余已发布流程的实例读取各自最新快照
 * - wf-12 从未发布成功（矩阵冲突），快照版本为 0，监控详情回退展示当前草稿
 */
export const instances:Instance[]=Array.from({length:80},(_,i)=>{
 const status:Instance['status']=i<12?'abnormal':i<22?'timeout':i<50?'running':'completed';
 const wf=i%12+1;
 const snapshotVersion=wf===2?1:wf===12?0:2;
 return {id:`INS-2026-${String(i+1).padStart(4,'0')}`,workflowId:`wf-${wf}`,applicant:users[i%8],domain:domains[i%5],currentNode:i%3===0?'直属主管审批':'金额判断',status,submittedAt:`2026-07-${String(10-i%9).padStart(2,'0')} ${String(8+i%10).padStart(2,'0')}:10`,duration:status==='timeout'?`${28+i}h`:`${i%9+1}h ${i%6*10}m`,risk:i<22?'high':i<45?'medium':'low',snapshotVersion,timeline:[{title:'提交申请',time:'09:10',status:'completed'},{title:'直属主管审批',time:'10:24',status:i%3===0?'current':'completed'},{title:'金额判断',time:'11:05',status:i%3!==0?'current':'pending'}]};
});
