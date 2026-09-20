import {useState} from 'react';import {X,FileEdit} from 'lucide-react';

/** 所有对已发布内容的调整都必须填写原因（新建调整草稿 / 恢复历史版本） */
export function ReasonModal({title,desc,confirmText='创建调整草稿',onCancel,onConfirm}:{
 title:string;desc:string;confirmText?:string;onCancel:()=>void;onConfirm:(reason:string)=>void;
}){
 const [reason,setReason]=useState('');
 const ok=reason.trim().length>=4;
 return <div className="drawer-backdrop" onClick={onCancel}>
  <div className="reason-modal" data-testid="reason-modal" onClick={e=>e.stopPropagation()}>
   <div className="reason-head"><div><FileEdit/><div><h3>{title}</h3><small>{desc}</small></div></div><button className="icon-btn" onClick={onCancel}><X/></button></div>
   <label>调整原因 <em>*</em>（至少 4 个字，将随版本快照留存）
    <textarea data-testid="reason-input" rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder="例如：财务审批限额按集团新规下调，同步更换代理审批角色"/>
   </label>
   {!ok&&reason.length>0&&<small className="field-error">原因不少于 4 个字</small>}
   <div className="reason-actions"><button className="secondary" onClick={onCancel}>取消</button><button data-testid="reason-confirm" disabled={!ok} onClick={()=>ok&&onConfirm(reason.trim())}>{confirmText}</button></div>
  </div>
 </div>;
}
