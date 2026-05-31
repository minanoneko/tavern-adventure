export default function UIPreview() {
  return (
    <div className="h-full overflow-y-auto p-4 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-2 border-b border-[var(--color-tavern-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl lg:text-4xl" style={{ color: 'var(--color-tavern-accent)', fontFamily: 'var(--font-display)' }}>
              UI Preview
            </h1>
            <p className="text-sm text-muted">CSS 和组件外观快速检查页</p>
          </div>
          <div className="text-xs text-muted">访问方式：?preview=ui</div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="panel p-4 space-y-4">
            <div className="panel-header">剧情面板</div>
            <div className="story-page p-4 space-y-3">
              <div className="text-xs text-muted">灰鹿酒馆 · 傍晚 · 多云</div>
              <h2 className="text-xl" style={{ color: 'var(--color-tavern-accent)' }}>账本上的空格</h2>
              <p className="leading-7">
                老板娘把账本推到灯下，指尖停在一行被擦掉的墨迹旁。桌边的送货人没有离开，
                只是把帽檐压低，像是在等你先开口。
              </p>
              <p className="leading-7">
                柜台后的铜铃轻轻一响，屋里所有人的声音都短暂低了下去。
              </p>
            </div>
          </div>

          <div className="panel p-4 space-y-3">
            <div className="panel-header">状态</div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="panel p-2">
                <div className="text-muted text-xs">HP</div>
                <div className="text-success">18/20</div>
              </div>
              <div className="panel p-2">
                <div className="text-muted text-xs">MP</div>
                <div>7/9</div>
              </div>
              <div className="panel p-2">
                <div className="text-muted text-xs">钱币</div>
                <div>1银 25铜</div>
              </div>
            </div>
            <input className="input text-sm w-full" defaultValue="我要求先确认报酬。" />
            <textarea className="input h-20 resize-none text-sm" defaultValue="这里用来检查长文本输入、边框、背景和移动端高度。" />
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          {[
            ['确认报酬条件', 'dialogue', '低风险'],
            ['复核账本墨迹', 'check', '普通'],
            ['暂缓并观察反应', 'cautious', '低风险'],
          ].map(([label, type, risk]) => (
            <button key={label} className="btn text-left p-4">
              <span className="block text-base">{label}</span>
              <span className="block text-xs text-muted mt-1">{type} · {risk}</span>
            </button>
          ))}
        </section>

        <section className="panel p-4 space-y-3">
          <div className="panel-header">按钮和提示</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary">主要操作</button>
            <button className="btn">普通按钮</button>
            <button className="btn btn-danger">危险操作</button>
            <button className="btn" disabled>禁用状态</button>
          </div>
          <div className="text-xs text-muted">这页只用于视觉检查，不触发游戏逻辑。</div>
        </section>
      </div>
    </div>
  );
}
