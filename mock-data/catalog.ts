import type {RoleInfo} from '../src/types';
export const users=['林秋','陈默','周礼','王宁','赵安','苏菲','陆远','方可'];
export const roles=['财务审批人','部门负责人','HRBP','法务经理','采购专员','系统管理员'];
export const domains=['财务','人力资源','采购','法务','IT服务'];
export const roleDirectory:RoleInfo[]=[{name:'财务审批人'},{name:'部门负责人'},{name:'HRBP'},{name:'法务经理',departed:true},{name:'采购专员'},{name:'系统管理员'}];
export const delegations:Record<string,string>={'陈默':'王宁','王宁':'苏菲','陆远':'赵安','赵安':'陆远'};
