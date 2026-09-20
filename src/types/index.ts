export type WorkflowStatus='draft'|'published'|'archived';
export type NodeKind='start'|'form'|'approval'|'condition'|'automation'|'notify'|'end';
export type NodeState='unconfigured'|'configuring'|'valid'|'invalid';
export interface FormField {id:string;label:string;type:'text'|'number'|'amount'|'date'|'select'|'attachment';required:boolean;options?:string[]}
export interface FlowNode {id:string;type:NodeKind;position:{x:number;y:number};data:{label:string;state:NodeState;config:Record<string,any>}}
export interface FlowEdge {id:string;source:string;target:string;label?:string}
export interface Version {version:number;createdAt:string;note:string;nodes:FlowNode[];edges:FlowEdge[]}
export interface Workflow {id:string;name:string;domain:string;status:WorkflowStatus;version:number;editor:string;updatedAt:string;publishedAt?:string;abnormalCount:number;nodes:FlowNode[];edges:FlowEdge[];versions:Version[]}
export interface Instance {id:string;workflowId:string;applicant:string;domain:string;currentNode:string;status:'abnormal'|'timeout'|'running'|'completed';submittedAt:string;duration:string;risk:'high'|'medium'|'low';timeline:{title:string;time:string;status:string}[]}
export interface ValidationIssue {nodeId:string;level:'error'|'warning';message:string}
export interface ApprovalRule {id:string;nodeId:string;nodeLabel:string;role:string;min:number;max:number|null;delegate:string}
export interface MatrixVersion {version:number;publishedAt:string;reason:string;rules:ApprovalRule[]}
export interface MatrixDraft {basedOn:number;reason:string;createdAt:string;rules:ApprovalRule[]}
export interface RoleInfo {name:string;departed?:boolean;successor?:string}
export type ConflictKind='overlap'|'cycle'|'departed';
export interface MatrixConflict {kind:ConflictKind;nodeIds:string[];nodeLabels:string[];roles:string[];range?:{min:number;max:number|null};chain?:string[];message:string}
export interface MatrixInstance {id:string;workflowName:string;applicant:string;status:'running'|'completed';matrixVersion:number;createdAt:string}
