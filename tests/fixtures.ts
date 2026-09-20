import {test as base,expect} from '@playwright/test';

/**
 * serial 套件内所有用例共享同一个 BrowserContext（等价于同一浏览器中反复刷新/跳转），
 * 用以真实验证“刷新后矩阵、草稿与实例快照仍对应”的本地持久化闭环。
 */
export const test=base.extend({
 page:async({browser},use)=>{
  const g=globalThis as typeof globalThis&{__flowdeskSharedCtx?:import('@playwright/test').BrowserContext};
  const ctx=g.__flowdeskSharedCtx||await (async()=>{
   const c=await browser.newContext();
   const p=await c.newPage();
   await p.goto('/');
   await p.evaluate(()=>localStorage.removeItem('flowdesk-state-v2'));
   await p.close();
   g.__flowdeskSharedCtx=c;
   return c;
  })();
  const page=await ctx.newPage();
  await use(page);
  await page.close();
 },
});
export {expect};
