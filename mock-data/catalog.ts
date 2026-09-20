import type {Role} from '../src/types';

export const users=['林秋','陈默','周礼','王宁','赵安','苏菲','陆远','方可'];

/** 角色目录：行政主管已离职且尚未交接（发布阻断边界案例） */
export const roles:Role[]=[
  {id:'role-1',name:'财务审批人',status:'active'},
  {id:'role-2',name:'部门负责人',status:'active'},
  {id:'role-3',name:'HRBP',status:'active'},
  {id:'role-4',name:'法务经理',status:'active',handoverTo:'部门负责人'},
  {id:'role-5',name:'采购专员',status:'active'},
  {id:'role-6',name:'系统管理员',status:'active'},
  {id:'role-7',name:'行政主管',status:'departed'},
];

export const roleNames=roles.map(r=>r.name);
export const domains=['财务','人力资源','采购','法务','IT服务'];
