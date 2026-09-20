export type WorkflowStatus='draft'|'adjusting'|'published'|'archived';
export type NodeKind='start'|'form'|'approval'|'condition'|'automation'|'notify'|'end';
export type NodeState='unconfigured'|'configuring'|'valid'|'invalid';
/** 角色在职状态：离职角色必须登记交接人，否则相关流程不得发布 */
export type RoleStatus='active'|'departed';
export interface Role{id:string;name:string;status:RoleStatus;handoverTo?:string}
/** 金额区间，max 为 null 表示上不封顶 */
export interface AmountRange{min:number;max:number|null}
/** 一条审批矩阵登记：节点 + 审批角色 + 金额区间 + 代理审批角色 */
export interface ApprovalMatrixEntry{nodeId:string;nodeLabel:string;role:string;range:AmountRange;delegateRole:string}
export interface FormField {id:string;label:string;type:'text'|'number'|'amount'|'date'|'select'|'attachment';required:boolean;options?:string[]}
export interface FlowNode {id:string;type:NodeKind;position:{x:number;y:number};data:{label:string;state:NodeState;config:Record<string,any>}}
export interface FlowEdge {id:string;source:string;target:string;label?:string}
/** 发布即冻结的权限快照：矩阵与角色目录随版本一起固化，运行中的实例持续读取旧快照 */
export interface PermissionSnapshot{matrix:ApprovalMatrixEntry[];roles:Role[]}
export interface Version {version:number;createdAt:string;note:string;nodes:FlowNode[];edges:FlowEdge[];matrix:ApprovalMatrixEntry[];roles:Role[]}
export interface Workflow {id:string;name:string;domain:string;status:WorkflowStatus;version:number;editor:string;updatedAt:string;publishedAt?:string;abnormalCount:number;nodes:FlowNode[];edges:FlowEdge[];versions:Version[];
  /** 调整草稿所基于的已发布版本 */baseVersion?:number;
  /** 调整草稿的必填原因 */draftReason?:string}
export interface Instance {id:string;workflowId:string;applicant:string;domain:string;currentNode:string;status:'abnormal'|'timeout'|'running'|'completed';submittedAt:string;duration:string;risk:'high'|'medium'|'low';
  /** 实例创建时冻结的快照版本，后续发布新版本不影响该实例 */snapshotVersion:number;
  timeline:{title:string;time:string;status:string}[]}
export type IssueKind='structure'|'matrix-role'|'matrix-range'|'matrix-delegate'|'matrix-overlap'|'matrix-cycle'|'matrix-departed';
export interface ValidationIssue {nodeId:string;level:'error'|'warning';message:string;kind?:IssueKind;role?:string;range?:AmountRange;conflictNodeId?:string;conflictRange?:AmountRange;chain?:string[]}
