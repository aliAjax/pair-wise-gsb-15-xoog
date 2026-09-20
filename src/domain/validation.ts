import type {
  AmountRange, ApprovalMatrixEntry, FlowEdge, FlowNode, Role, ValidationIssue, Workflow,
} from '../types';

/* ---------------- 审批矩阵 / 代理链（纯函数校验层，不依赖 React 与 store） ---------------- */

export const rangeText = (r?: AmountRange): string => {
  if (!r) return '未登记区间';
  const lo = `¥${r.min.toLocaleString()}`;
  const hi = r.max === null ? '上不封顶' : `¥${r.max.toLocaleString()}`;
  return `${lo} ~ ${hi}`;
};

export const validRange = (r?: Partial<AmountRange>|null): r is AmountRange =>
  !!r && typeof r.min === 'number' && r.min >= 0 && (r.max === null || (typeof r.max === 'number' && r.max >= (r.min as number)));

/** 从流程节点中提取审批矩阵登记项（只提取已登记角色与区间的节点） */
export const extractMatrix = (nodes: FlowNode[]): ApprovalMatrixEntry[] =>
  nodes
    .filter(n => n.type === 'approval')
    .map(n => ({
      nodeId: n.id,
      nodeLabel: n.data.label,
      role: n.data.config.role as string,
      range: {min: Number(n.data.config.min ?? 0), max: n.data.config.max === null || n.data.config.max === '' || n.data.config.max === undefined ? null : Number(n.data.config.max)},
      delegateRole: n.data.config.delegateRole as string,
    }));

/** 两个半开区间（按金额归属：min ≤ x < max）是否重叠；边界相接不算重叠，null 为无上限 */
export const rangesOverlap = (a: AmountRange, b: AmountRange): boolean => {
  const aMax = a.max ?? Infinity;
  const bMax = b.max ?? Infinity;
  return a.min < bMax && b.min < aMax;
};

const overlapRange = (a: AmountRange, b: AmountRange): AmountRange => ({
  min: Math.max(a.min, b.min),
  max: (a.max === null || b.max === null) ? null : Math.min(a.max, b.max),
});

/** 代理角色映射中的有向环：返回所有成环角色集合（标准三色递归 DFS） */
export const findDelegateCycle = (matrix: ApprovalMatrixEntry[]): string[] => {
  // 同一角色可能登记在多个节点：以首次登记的代理关系建图
  const roleOf = new Map<string, string>();
  matrix.forEach(m => { if (m.role && !roleOf.has(m.role)) roleOf.set(m.role, m.delegateRole); });
  const WHITE=0,GRAY=1,BLACK=2;
  const color = new Map<string,number>();
  const cycle = new Set<string>();
  const visit=(node:string,stack:string[]):boolean=>{
    color.set(node,GRAY);stack.push(node);
    const next=roleOf.get(node);
    if(next!==undefined&&roleOf.has(next)){
      const st=color.get(next);
      if(st===GRAY){ // 边指向当前递归栈 → 成环，取出环段
        stack.slice(stack.indexOf(next)).forEach(r=>cycle.add(r));
      }else if(st!==BLACK){
        visit(next,stack);
      }
    }
    stack.pop();color.set(node,BLACK);
    return false;
  };
  roleOf.forEach((_,role)=>{if(color.get(role)===undefined)visit(role,[]);});
  void WHITE;void GRAY;void BLACK;
  return [...cycle];
};

export interface MatrixCheckResult {
  issues: ValidationIssue[];
  matrix: ApprovalMatrixEntry[];
}

/**
 * 审批矩阵校验，三类发布阻断：
 * 1. 同一审批角色的金额区间重叠（列出节点、角色与冲突区间）
 * 2. 代理审批链成环（列出成环节点、角色与链路）
 * 3. 审批角色离职且未登记交接人（按角色目录判断）
 */
export const checkApprovalMatrix = (nodes: FlowNode[], roles: Role[]): MatrixCheckResult => {
  const issues: ValidationIssue[] = [];
  const matrix = extractMatrix(nodes);
  const roleMap = new Map(roles.map(r => [r.name, r]));

  nodes.filter(n => n.type === 'approval').forEach(n => {
    const c = n.data.config;
    // 登记项完整性
    if (!c.role) {
      issues.push({nodeId: n.id, level: 'error', kind: 'matrix-role', message: '审批节点未登记审批角色', role: c.role});
    }
    if (!validRange(c.min !== undefined || c.max !== undefined ? {min: Number(c.min), max: c.max === null || c.max === '' ? null : Number(c.max)} : null)) {
      issues.push({nodeId: n.id, level: 'error', kind: 'matrix-range', message: '审批金额区间无效（下限需 ≥ 0，且不大于上限）', role: c.role});
    }
    if (!c.delegateRole) {
      issues.push({nodeId: n.id, level: 'error', kind: 'matrix-delegate', message: '审批节点未登记代理审批人', role: c.role});
    }
  });

  // 阻断一：同角色区间重叠
  matrix.forEach(a => {
    matrix.forEach(b => {
      if (a.nodeId >= b.nodeId) return; // 每对只报一次（id 稳定，保证确定性）
      if (a.role && b.role && a.role === b.role && validRange(a.range) && validRange(b.range) && rangesOverlap(a.range, b.range)) {
        const hit = overlapRange(a.range, b.range);
        issues.push({
          nodeId: a.nodeId, level: 'error', kind: 'matrix-overlap', role: a.role, range: a.range,
          conflictNodeId: b.nodeId, conflictRange: b.range,
          message: `审批角色「${a.role}」金额区间重叠：节点「${a.nodeLabel}」${rangeText(a.range)} 与节点「${b.nodeLabel}」${rangeText(b.range)} 冲突（重叠区间 ${rangeText(hit)}）`,
        });
      }
    });
  });

  // 阻断二：代理链成环
  const cycleRoles = findDelegateCycle(matrix.filter(m => m.role && m.delegateRole));
  if (cycleRoles.length) {
    matrix.filter(m => cycleRoles.includes(m.role)).forEach(m => {
      const idx = cycleRoles.indexOf(m.role);
      const chain = [...cycleRoles.slice(idx), ...cycleRoles.slice(0, idx), m.role];
      issues.push({
        nodeId: m.nodeId, level: 'error', kind: 'matrix-cycle', role: m.role, chain,
        message: `代理审批链成环：${chain.join(' → ')}，节点「${m.nodeLabel}」的代理安排无法兜底`,
      });
    });
  }

  // 阻断三：角色离职未交接；已交接的给警告提示（按离职角色接管）
  matrix.forEach(m => {
    const r = roleMap.get(m.role);
    if (r && r.status === 'departed' && !r.handoverTo) {
      issues.push({nodeId: m.nodeId, level: 'error', kind: 'matrix-departed', role: r.name,
        message: `审批角色「${r.name}」已离职且未登记交接人，节点「${m.nodeLabel}」不得发布`});
    } else if (r && r.status === 'departed' && r.handoverTo) {
      issues.push({nodeId: m.nodeId, level: 'warning', kind: 'matrix-departed', role: r.name,
        message: `审批角色「${r.name}」已离职，当前由「${r.handoverTo}」交接，建议尽快更新矩阵`});
    }
  });

  return {issues, matrix};
};

/* ---------------- 流程结构校验（沿用原有规则，独立为纯函数） ---------------- */

export const checkStructure = (nodes: FlowNode[], edges: FlowEdge[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!nodes.some(n => n.type === 'end')) {
    issues.push({nodeId: nodes[0]?.id || 'flow', level: 'error', kind: 'structure', message: '流程缺少结束节点'});
  }
  const linked = new Set(edges.flatMap(e => [e.source, e.target]));
  nodes.filter(n => n.type !== 'start' && n.type !== 'end' && !linked.has(n.id)).forEach(n =>
    issues.push({nodeId: n.id, level: 'error', kind: 'structure', message: '必经节点不能孤立'}));
  nodes.forEach(n => {
    if (n.type === 'condition' && !n.data.config.ruleType) {
      issues.push({nodeId: n.id, level: 'error', kind: 'structure', message: '条件分支规则未配置'});
    }
    if (n.type === 'approval' && !n.data.config.approverSource) {
      issues.push({nodeId: n.id, level: 'error', kind: 'structure', message: '审批人不能为空'});
    }
  });
  return issues;
};

export const validateWorkflow = (w: Workflow, roles: Role[]): ValidationIssue[] => {
  const structure = checkStructure(w.nodes, w.edges);
  const {issues: matrix} = checkApprovalMatrix(w.nodes, roles);
  return [...structure, ...matrix];
};

/** 读取实例对应的冻结快照；找不到指定版本时回退到最新版本（保证旧数据可展示） */
export const resolveSnapshot = (w: Workflow, snapshotVersion: number, roles: Role[] = []): {
  version: number; createdAt: string; note: string; nodes: FlowNode[]; edges: FlowEdge[]; matrix: ApprovalMatrixEntry[]; roles: Role[];
} => {
  const hit = w.versions.find(v => v.version === snapshotVersion);
  const fallback = [...w.versions].sort((a, b) => b.version - a.version)[0];
  const v = hit || fallback;
  if (v) return v;
  // 从未发布过：以当前草稿内容合成一份“工作副本”，仅用于画布展示
  return {version: 0, createdAt: '-', note: '尚未发布', nodes: w.nodes, edges: w.edges, matrix: extractMatrix(w.nodes), roles};
};
