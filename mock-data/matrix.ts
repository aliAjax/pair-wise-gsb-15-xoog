import type {MatrixVersion} from '../src/types';
export const matrixSeed:MatrixVersion[]=[{version:1,publishedAt:'2026-06-30 10:00',reason:'初始审批矩阵基线',rules:[
 {id:'r-lead',nodeId:'approval',nodeLabel:'直属主管审批',role:'部门负责人',min:0,max:5000,delegate:'陈默'},
 {id:'r-finance',nodeId:'approval',nodeLabel:'财务复核',role:'财务审批人',min:5000,max:50000,delegate:'周礼'},
 {id:'r-legal',nodeId:'approval',nodeLabel:'高额合同会签',role:'法务经理',min:50000,max:null,delegate:'陆远'}]}];
