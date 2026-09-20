import {test,expect} from './fixtures';

test.describe.serial('审批矩阵与代理链闭环',()=>{
 test('Dashboard 进入编辑器，审批节点展示矩阵登记区',async({page})=>{
  await page.goto('/');
  await expect(page.getByTestId('kpi-grid')).toBeVisible();
  await page.getByTestId('recent-workflow').first().click();
  await expect(page.getByTestId('flow-canvas')).toBeVisible();
  await page.goto('/workflows/wf-1');
  await page.getByTestId('canvas-node-approval').click();
  await expect(page.getByTestId('config-panel')).toContainText('审批矩阵登记');
  await expect(page.getByLabel('审批角色',{exact:true})).toBeVisible();
  await expect(page.getByLabel('金额下限')).toBeVisible();
  await expect(page.getByLabel('代理审批角色')).toBeVisible();
 });

 test('结构校验：修复条件分支后 0 错误（矩阵字段已随种子登记）',async({page})=>{
  await page.goto('/workflows/wf-1');
  await page.getByTestId('validate-button').click();
  await expect(page.getByTestId('canvas-node-condition')).toHaveClass(/invalid/);
  await expect(page.getByTestId('issues-panel')).toContainText('条件分支规则未配置');
  await page.getByTestId('canvas-node-condition').click();
  await page.getByLabel('条件字段').selectOption('amount');
  await page.getByLabel('条件比较值').fill('5000');
  await page.getByTestId('save-node-config').click();
  await page.getByTestId('validate-button').click();
  await expect(page.getByTestId('error-count')).toContainText('0 错误');
 });

 test('区间重叠 / 代理成环 / 离职未交接：矩阵页列出节点角色冲突区间且不得发布；全部修复后发布冻结 v1',async({page})=>{
  await page.goto('/workflows/wf-12/matrix');
  await expect(page.getByTestId('matrix-table')).toBeVisible();
  // 列出节点、角色和冲突区间
  const overlap=page.getByTestId('conflict-matrix-overlap').first();
  await expect(overlap).toContainText('财务审批人');
  await expect(overlap).toContainText('小额财务审批');
  await expect(overlap).toContainText('中额财务审批');
  await expect(overlap).toContainText('¥3,000 ~ ¥5,000');
  const cycle=page.getByTestId('conflict-matrix-cycle').first();
  await expect(cycle).toContainText('代理审批链成环');
  await expect(cycle).toContainText('财务审批人 → 采购专员');
  const departed=page.getByTestId('conflict-matrix-departed').filter({hasText:'行政主管'});
  await expect(departed).toContainText('离职且未登记交接人');
  // 发布被阻断：矩阵页跳回编辑器后点发布
  await page.getByTestId('matrix-validate').click();
  await page.getByTestId('publish-button').click();
  await expect(page.getByRole('status')).toContainText('无法发布');
  // 修复一：为离职角色登记交接人（阻断降级为警告）
  await page.goto('/workflows/wf-12/matrix');
  await page.getByLabel('行政主管 交接人').selectOption('部门负责人');
  await expect(page.getByTestId('conflict-matrix-departed')).toHaveClass(/conflict-warning/);
  await expect(page.getByTestId('conflict-matrix-departed')).toContainText('已离职，当前由「部门负责人」交接');
  // 修复二：消除金额区间重叠（小额上限调到 3000，与中额边界相接不算重叠）
  await page.goto('/workflows/wf-12');
  await page.getByTestId('canvas-node-ap-1').click();
  await page.getByLabel('金额上限').fill('3000');
  await page.getByTestId('save-node-config').click();
  // 修复三：打破代理环（采购专员改代理系统管理员）
  await page.getByTestId('canvas-node-ap-3').click();
  await page.getByLabel('代理审批角色').selectOption('系统管理员');
  await page.getByTestId('save-node-config').click();
  await page.getByTestId('validate-button').click();
  await expect(page.getByTestId('error-count')).toContainText('0 错误');
  await page.getByTestId('publish-button').click();
  await expect(page.getByRole('status')).toContainText('v1 已冻结');
  // 矩阵页出现冻结快照
  await page.goto('/workflows/wf-12/matrix');
  await expect(page.getByTestId('snapshot-panel')).toContainText('线上冻结快照 v1');
  await expect(page.getByTestId('snapshot-panel')).toContainText('行政主管（离职→部门负责人）');
 });

 test('已发布流程冻结：只读、必须新建带原因草稿；刷新后草稿与原因仍在；旧实例读旧快照',async({page})=>{
  await page.goto('/workflows/wf-2');
  await expect(page.getByTestId('flow-canvas')).toHaveAttribute('data-readonly','true');
  // 发布按钮变为“新建调整草稿”，点击必须填写原因
  await page.getByTestId('adjust-button').click();
  await expect(page.getByTestId('reason-modal')).toBeVisible();
  await page.getByTestId('reason-confirm').click({force:true});
  await expect(page.getByTestId('reason-modal')).toBeVisible(); // 原因不足，无法提交
  await page.getByTestId('reason-input').fill('集团新规：主管审批上限调整为 8000 元');
  await page.getByTestId('reason-confirm').click();
  await expect(page.getByTestId('reason-modal')).toHaveCount(0);
  await expect(page.getByTestId('adjust-banner')).toContainText('v2');
  await expect(page.getByTestId('adjust-banner')).toContainText('集团新规');
  // 草稿可编辑：调整金额上限
  await page.getByTestId('canvas-node-approval').click();
  await page.getByLabel('金额上限').fill('8000');
  await page.getByTestId('save-node-config').click();
  await page.getByRole('button',{name:'保存草稿'}).click();
  await expect(page.getByRole('status')).toContainText('调整草稿已保存');
  // 刷新后矩阵/草稿仍对应
  await page.reload();
  await expect(page.getByTestId('adjust-banner')).toBeVisible();
  await expect(page.locator('.adjust-indicator')).toContainText('v2');
  // 线上运行中的实例继续读 v1 旧快照
  await page.goto('/monitor');
  await page.getByRole('button',{name:'异常',exact:true}).click();
  await page.getByTestId('instance-row').filter({hasText:'INS-2026-0002'}).click();
  await expect(page.getByTestId('snapshot-strip')).toContainText('读取权限快照 v1');
  await expect(page.getByTestId('snapshot-strip')).toContainText('线上已到 v2，本实例继续读旧快照');
 });

 test('新实例使用新版本：调整发布为 v3 前后发起实例快照不同',async({page})=>{
  // 先以当前 v2 发起一个实例（草稿未发布，仍走最新已发布快照 v2）
  await page.goto('/workflows/wf-2/preview');
  await expect(page.locator('.preview-header')).toContainText('v2');
  await page.getByLabel('申请金额').fill('12000');
  await page.getByLabel('申请说明').fill('测试高额差旅申请');
  await expect(page.getByTestId('branch-result')).toContainText('高额分支');
  await page.getByTestId('simulate-submit').click();
  const before=await page.getByTestId('launch-result').innerText();
  const m=before.match(/INS-\d{4}-\d{4}/);
  expect(m,'应成功发起实例并显示编号').not.toBeNull();
  const idV2=m![0];
  await expect(page.getByTestId('launch-result')).toContainText('v2');
  // 发布调整草稿 -> v3（原因已在上一用例持久化，重新补齐编辑内容以防存储重置）
  await page.goto('/workflows/wf-2');
  await expect(page.getByTestId('adjust-banner')).toBeVisible();
  await page.getByTestId('publish-button').click();
  await expect(page.getByRole('status')).toContainText('v3 已冻结');
  // 再发起实例 -> v3
  await page.goto('/workflows/wf-2/preview');
  await page.getByLabel('申请金额').fill('3000');
  await page.getByLabel('申请说明').fill('标准申请');
  await page.getByTestId('simulate-submit').click();
  await expect(page.getByTestId('launch-result')).toContainText('v3');
  // 监控列表中两个实例的快照版本互不相同
  await page.goto('/monitor');
  const rowV2=page.getByTestId('instance-row').filter({hasText:idV2});
  await expect(rowV2.locator('.snapshot-badge')).toContainText('v2');
  await expect(page.getByTestId('instance-row').first().locator('.snapshot-badge')).toContainText('v3');
  // 打开 v3 实例，画布与矩阵来自新快照
  await page.getByTestId('instance-row').first().click();
  await expect(page.getByTestId('snapshot-strip')).toContainText('v3');
  await expect(page.getByTestId('instance-detail')).toContainText('快照审批矩阵');
 });

 test('恢复历史版本必须带原因生成调整草稿',async({page})=>{
  await page.goto('/workflows/wf-2/versions');
  await expect(page.getByTestId('version-compare')).toContainText('新增节点');
  await page.getByTestId('restore-version').click();
  await expect(page.getByTestId('reason-modal')).toBeVisible();
  await page.getByTestId('reason-input').fill('回退：新版本代理审批人配置需要重新评审');
  await page.getByTestId('reason-confirm').click();
  await expect(page).toHaveURL(/\/workflows\/wf-2$/);
  await expect(page.getByRole('status')).toContainText('已基于 v1 创建调整草稿');
  await expect(page.getByTestId('adjust-banner')).toContainText('回退');
 });

 test('表单预览金额驱动条件分支',async({page})=>{
  await page.goto('/workflows/wf-1/preview');
  await expect(page.getByTestId('branch-result')).toContainText('标准分支');
  await page.getByLabel('申请金额').fill('12000');
  await expect(page.getByTestId('branch-result')).toContainText('高额分支');
 });

 test('1440px 桌面视觉与控制台验证',async({page})=>{
  const errors:string[]=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  for(const path of ['/','/workflows/wf-1','/workflows/wf-12/matrix','/monitor']){await page.goto(path);await page.waitForTimeout(250);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);expect(overflow,`${path} 不应横向溢出`).toBeFalsy()}
  await page.goto('/workflows/wf-12'); await page.screenshot({path:'test-results/wf12-editor.png',fullPage:true});
  await page.goto('/workflows/wf-12/matrix'); await page.screenshot({path:'test-results/wf12-matrix.png',fullPage:true});
  expect(errors,'浏览器 console 不应出现 error').toEqual([]);
 });
});
