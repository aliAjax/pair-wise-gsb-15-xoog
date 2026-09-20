import {useMemo,useState} from 'react';import {useNavigate,useParams} from 'react-router-dom';import {ArrowLeft,GitCompare,History,RotateCcw,Snowflake} from 'lucide-react';
import {PageTitle} from '../components/common';
import {ReasonModal} from '../components/ReasonModal';
import {useAppStore} from '../store/useAppStore';
import {rangeText} from '../domain/validation';

export function Versions(){
 const {id}=useParams(),nav=useNavigate(),store=useAppStore(),w=store.workflows.find(x=>x.id===id)!;
 const all=[...w.versions].sort((a,b)=>b.version-a.version);
 const [left,setLeft]=useState(all.at(-1)?.version||1),[right,setRight]=useState(all[0]?.version||w.version),[askRestore,setAskRestore]=useState(false);
 const a=all.find(v=>v.version===left),b=all.find(v=>v.version===right);
 const diff=useMemo(()=>{if(!a||!b)return {added:[],removed:[],changed:[]};
  return {added:b.nodes.filter(n=>!a.nodes.some(x=>x.id===n.id)),removed:a.nodes.filter(n=>!b.nodes.some(x=>x.id===n.id)),changed:b.nodes.filter(n=>{const old=a.nodes.find(x=>x.id===n.id);return old&&JSON.stringify(old.data.config)!==JSON.stringify(n.data.config)})}}, [a,b]);
 const restore=(reason?:string)=>{store.setCurrent(w.id);store.restore(left,reason);nav(`/workflows/${w.id}`)};
 return <div className="page versions-page"><button className="back-link" onClick={()=>nav(`/workflows/${id}`)}><ArrowLeft/>返回编辑器</button>
 <PageTitle eyebrow="流程版本" title="Version History" desc={`${w.name} · 每次发布都会冻结矩阵与角色目录快照；恢复旧版本只会生成带原因的调整草稿。`}/>
 <div className="version-layout"><aside className="panel version-list"><h3><History/>版本记录</h3>{all.map((v,i)=><button key={v.version} className={v.version===right?'active':''} onClick={()=>setRight(v.version)}><span><b>v{v.version}</b>{i===0&&<em>当前线上</em>}</span><small>{v.createdAt}</small><p>{v.note}</p><div className="snapshot-mini"><Snowflake width={11}/>{v.matrix.length} 条矩阵登记 · {v.roles.filter(r=>r.status==='departed').length} 个离职角色</div></button>)}
  {!all.length&&<p style={{color:'#8b938f',fontSize:12}}>从未发布成功，暂无快照版本</p>}
 </aside>
 <section className="panel compare" data-testid="version-compare"><div className="compare-head"><div><GitCompare/><h2>版本对比</h2></div><button className="secondary" data-testid="restore-version" onClick={()=>{if(!w.versions.length){restore();return}setAskRestore(true)}}><RotateCcw/>恢复 v{left} 为草稿</button></div>
  <div className="compare-select"><label>基准版本<select value={left} onChange={e=>setLeft(Number(e.target.value))}>{all.map(v=><option key={v.version} value={v.version}>v{v.version} · {v.createdAt}</option>)}</select></label><span>→</span><label>比较版本<select value={right} onChange={e=>setRight(Number(e.target.value))}>{all.map(v=><option key={v.version} value={v.version}>v{v.version} · {v.createdAt}</option>)}</select></label></div>
  <div className="diff-summary"><article><small>新增节点</small><b>{diff.added.length}</b></article><article><small>删除节点</small><b>{diff.removed.length}</b></article><article><small>配置变化</small><b>{diff.changed.length}</b></article><article><small>连线变化</small><b>{Math.abs((b?.edges.length||0)-(a?.edges.length||0))}</b></article></div>
  <div className="diff-list"><h3>变更明细</h3>{diff.added.map(n=><div key={n.id} className="diff added"><span>＋ 新增</span><b>{n.data.label}</b><small>{n.type} 节点</small></div>)}{diff.removed.map(n=><div key={n.id} className="diff removed"><span>− 删除</span><b>{n.data.label}</b><small>{n.type} 节点</small></div>)}{diff.changed.map(n=><div key={n.id} className="diff changed"><span>~ 配置</span><b>{n.data.label}</b><small>{n.type==='approval'&&n.data.config.role?`角色 ${n.data.config.role} · ${rangeText({min:Number(n.data.config.min),max:n.data.config.max===null?null:Number(n.data.config.max)})} · 代理 ${n.data.config.delegateRole}`:'节点配置已更新'}</small></div>)}
   {!diff.added.length&&!diff.removed.length&&!diff.changed.length&&<div className="empty-diff">这两个版本的节点结构一致</div>}
   <div className="release-note"><small>发布说明</small><p>{b?.note}</p></div></div>
 </section></div>
 {askRestore&&<ReasonModal title={`恢复 v${left} 为调整草稿`} desc={`线上 v${w.version} 保持运行，恢复内容将作为带原因的新草稿，发布后才生效`} confirmText="生成调整草稿" onCancel={()=>setAskRestore(false)} onConfirm={r=>{setAskRestore(false);restore(r)}}/>}
 </div>;
}
