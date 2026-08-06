<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BackButton from '../components/BackButton.vue'
import LogoMark from '../components/LogoMark.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

onMounted(async () => {
  if (!(await auth.restore())) await router.replace('/login')
})
</script>

<template>
  <main class="portal-shell manual-page">
    <header class="portal-topbar">
      <div class="portal-topbar-start">
        <BackButton fallback="/functions" />
        <RouterLink class="portal-logo" to="/functions"><LogoMark />AutoBuff</RouterLink>
      </div>
      <nav><RouterLink to="/functions">功能中心</RouterLink><strong>使用手册</strong></nav>
    </header>

    <div class="wiki-layout">
      <aside class="wiki-sidebar" aria-label="使用手册目录">
        <div class="wiki-sidebar-title"><span>?</span><div><strong>使用手册</strong><small>五大模式完整指南</small></div></div>
        <nav>
          <p>快速开始</p>
          <a href="#overview">模式怎么选</a>
          <a href="#preparation">开始前准备</a>
          <a href="#buff-settings">Buff 通用设置</a>
          <p>五大模式</p>
          <a href="#dead-flower">死花模式</a>
          <a href="#live-flower">活花模式</a>
          <a href="#temple">神殿模式</a>
          <a href="#follow-heal">跟补模式</a>
          <a href="#monitor">监控模式</a>
          <p>网页与排障</p>
          <a href="#web-console">网页远程功能</a>
          <a href="#troubleshooting">常见问题</a>
          <a href="#safety">使用提醒</a>
        </nav>
        <div class="wiki-side-note"><strong>第一次使用？</strong><span>先看“模式怎么选”和“开始前准备”，再阅读对应模式。</span></div>
      </aside>

      <article class="wiki-article">
        <div class="wiki-breadcrumb">使用手册 <span>/</span> 客户端教程 <span>/</span> 五大模式</div>
        <header class="wiki-title">
          <div><p class="portal-kicker">AUTOBUFF GUIDE</p><h1>五大模式使用手册</h1></div>
          <span class="wiki-status">macOS / Windows</span>
        </header>
        <p class="wiki-intro">本手册对应当前版本的死花、活花、神殿、跟补和监控模式。先在客户端完成窗口、权限与按键配置；需要远程查看、启停或挂绳组队时，再进入网页功能中心。</p>

        <section class="wiki-callout is-info">
          <strong>客户端与网页各做什么</strong>
          <p>客户端负责识别游戏画面和执行所选模式；网页负责查看监控数据、管理已登录客户端、远程启停和配置挂绳队伍。网页关闭不会让已启动的普通模式停止。</p>
        </section>

        <section id="overview" class="wiki-section">
          <p class="wiki-section-number">01</p><h2>模式怎么选</h2>
          <p>按角色所在场景和你希望触发的行为选择。五种模式一次只能运行一种。</p>
          <div class="wiki-mode-grid">
            <a href="#dead-flower"><span>DEAD</span><strong>死花模式</strong><p>平时留在自由市场，Buff 到期时离开市场、移动释放，再返回市场。</p><small>需要输入与画面识别</small></a>
            <a href="#live-flower"><span>LIVE</span><strong>活花模式</strong><p>留在当前地图按倒计时循环释放 Buff，可配置释放前后的短距离移动。</p><small>最适合先做基础测试</small></a>
            <a href="#temple"><span>TEMPLE</span><strong>神殿模式</strong><p>包含休息室、挂绳组队和进出自由三种时间神殿专用流程。</p><small>按具体场景选择子功能</small></a>
            <a href="#follow-heal"><span>FOLLOW HEAL</span><strong>跟补模式</strong><p>持续补血并用瞬移维持横向站位，Buff 到期时优先补 Buff。</p><small>需要标记跟补基准点</small></a>
            <a href="#monitor"><span>MONITOR</span><strong>监控模式</strong><p>只读取画面，显示地图、位置、经验和风险状态，并同步到网页。</p><small>不会发送键盘或鼠标输入</small></a>
          </div>
          <section class="wiki-callout is-warning"><strong>模式授权</strong><p>账号默认开放死花、活花和神殿模式；跟补、监控以及地图管理可能需要管理员授权。客户端若提示当前账号无权使用，请联系管理员在网页用户管理中开启。</p></section>
        </section>

        <section id="preparation" class="wiki-section">
          <p class="wiki-section-number">02</p><h2>开始前准备</h2>
          <ol class="wiki-steps">
            <li><span>1</span><div><strong>登录同一账号</strong><p>打开 AutoBuff 客户端并登录。需要网页远程功能时，网页也登录同一账号。</p></div></li>
            <li><span>2</span><div><strong>打开并保持游戏窗口可见</strong><p>建议使用窗口或无边框窗口模式。不要最小化游戏，也不要让其他窗口长时间遮住需要识别的区域。</p></div></li>
            <li><span>3</span><div><strong>选择正确的游戏窗口</strong><p>点击客户端顶部的“识别窗口”或窗口选择按钮，核对窗口标题和预览。更换角色窗口后要重新选择。</p></div></li>
            <li><span>4</span><div><strong>检查系统权限</strong><p>会自动按键的模式需要辅助功能权限；依赖小地图、市场或弹窗识别的模式还需要屏幕录制权限。macOS 授权后若仍未生效，请完全退出客户端再打开。</p></div></li>
            <li><span>5</span><div><strong>选择模式并完成专属设置</strong><p>先停止当前运行，再切换模式。运行中配置会锁定，修改参数前请先停止。</p></div></li>
            <li><span>6</span><div><strong>短时间观察日志</strong><p>第一次运行至少观察 1–2 分钟，确认窗口、按键、识别和角色位置都正确后再离开。</p></div></li>
          </ol>
          <div class="wiki-table-wrap">
            <table class="wiki-parameter-table">
              <thead><tr><th>模式</th><th>辅助功能</th><th>屏幕录制</th><th>必须启用 Buff</th></tr></thead>
              <tbody>
                <tr><td>死花</td><td>需要</td><td>需要</td><td>需要</td></tr>
                <tr><td>活花</td><td>需要</td><td>不需要</td><td>需要</td></tr>
                <tr><td>神殿</td><td>需要</td><td>休息室、挂绳、进出自由需要</td><td>休息室和进出自由需要；挂绳可不启用</td></tr>
                <tr><td>跟补</td><td>需要</td><td>需要</td><td>可不启用</td></tr>
                <tr><td>监控</td><td>不需要</td><td>需要</td><td>不需要</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="buff-settings" class="wiki-section">
          <p class="wiki-section-number">03</p><h2>Buff 通用设置</h2>
          <p>死花、活花、跟补和神殿功能共用 Buff 槽位。每个启用的槽位都要选择按键；除休息室外，还要填写有效持续时间。</p>
          <ul>
            <li><strong>添加与启用：</strong>点击“添加”增加槽位，只有开关已打开的 Buff 才会执行。</li>
            <li><strong>按键：</strong>点击“选键”并选择与游戏快捷键一致的按键，建议先在游戏里手动测试。</li>
            <li><strong>持续时间：</strong>从按键完成时开始独立倒计时。不同 Buff 可设置不同时间，到期后分别进入下一轮。</li>
            <li><strong>多 Buff 合并：</strong>死花和跟补会把 10 秒内即将到期的 Buff 合并到同一轮，减少重复切换流程。</li>
            <li><strong>运行中：</strong>倒计时与参数会锁定；停止后才能新增、删除或修改槽位。</li>
          </ul>
        </section>

        <section id="dead-flower" class="wiki-section wiki-mode-section">
          <p class="wiki-section-number">04 · DEAD FLOWER</p><div class="wiki-heading-row"><h2>死花模式</h2><span class="feature-ready">进出自由市场</span></div>
          <p>角色完成一轮 Buff 后会进入自由市场等待。Buff 到期时，客户端识别并离开自由市场，按配置移动到释放位置，释放本轮 Buff，然后重新进入自由市场。</p>
          <h3>运行前设置</h3>
          <ol>
            <li>至少启用一个 Buff，并设置按键与持续时间。</li>
            <li>选择“出市场后移动方式”：<strong>先右再左</strong>、<strong>只向左（鱼窝）</strong>或<strong>只向右（骨龙、忘却）</strong>。</li>
            <li>设置跳跃键。此键用于离开市场和移动过程中的防卡处理。</li>
            <li>需要等待时坐下，可开启“空闲时坐椅子”并设置椅子键。</li>
            <li>自动识别市场出口不稳定时，点击“自由市场传送门 / 标记传送门”，在小地图上手动标记。</li>
          </ol>
          <h3>运行后会发生什么</h3>
          <ul>
            <li>若启动时在怪物地图，会先释放已到期 Buff，再尝试回到自由市场。</li>
            <li>若启动时已在自由市场，会等待到期，再寻找出口离开。</li>
            <li>离开市场后按所选方向移动，连续按两次技能降低吞键概率。</li>
            <li>释放完成并等待技能后摇后，自动点击自由市场入口返回；失败时会重试并写入日志。</li>
          </ul>
          <section class="wiki-callout is-warning"><strong>传送门标记会受窗口变化影响</strong><p>手动标记优先于自动识别。改变游戏窗口大小、分辨率、UI 比例或移动窗口后，请停止运行并重新标记。</p></section>
        </section>

        <section id="live-flower" class="wiki-section wiki-mode-section">
          <p class="wiki-section-number">05 · LIVE FLOWER</p><div class="wiki-heading-row"><h2>活花模式</h2><span class="feature-ready">当前地图循环</span></div>
          <p>活花不会进入自由市场。启动后立即释放启用的 Buff，之后按每个 Buff 的独立倒计时在当前地图重复释放。</p>
          <h3>运行前设置</h3>
          <ol>
            <li>至少启用一个 Buff，并设置按键与持续时间。</li>
            <li>选择移动方式：<strong>原地不动</strong>、<strong>右走（回左）</strong>或<strong>左走（回右）</strong>。</li>
            <li>需要随机提前释放时开启“提前释放”，填写 1–60 秒。每轮会在设定范围内随机提前，不是固定提前相同秒数。</li>
            <li>需要在空闲期坐下时，开启“空闲时坐椅子”并设置椅子键。</li>
          </ol>
          <h3>运行后会发生什么</h3>
          <ul>
            <li>每个技能会连续短按两次；多个到期 Buff 之间会留出拟人间隔。</li>
            <li>选择移动后，角色会在释放前向指定方向移动，释放结束后向反方向回位并松开方向键。</li>
            <li>距离下一次释放超过 5 秒且已开启椅子时，只会按一次椅子键；下轮释放后再重新判断。</li>
          </ul>
          <section class="wiki-callout is-info"><strong>第一次建议这样测试</strong><p>先选“原地不动”，只启用一个持续时间较短的 Buff，确认倒计时和按键正确；再逐步开启移动、提前释放和椅子。</p></section>
        </section>

        <section id="temple" class="wiki-section wiki-mode-section">
          <p class="wiki-section-number">06 · TEMPLE MODE</p><div class="wiki-heading-row"><h2>神殿模式</h2><span class="feature-ready">三种子功能</span></div>
          <p>神殿模式用于时间神殿场景。选择模式后，还要在“神殿功能”中选择休息室、挂绳组队或进出自由；三者一次只能运行一个。</p>
          <div class="wiki-choice-grid">
            <article><span>人数变化触发</span><h3>休息室</h3><p>启动、人数增加或自动接受组队成功时释放整轮 Buff。</p><a href="#temple-lounge">查看步骤 →</a></article>
            <article><span>网页统一建队</span><h3>挂绳组队</h3><p>管理 1–5 台客户端，自动建队，并按老板 Buff 周期协同释放。</p><a href="#temple-rope">查看步骤 →</a></article>
            <article><span>定时进出自由市场</span><h3>进出自由</h3><p>沿用死花的市场识别、移动、释放和返回流程。</p><a href="#temple-free">查看步骤 →</a></article>
          </div>

          <h3 id="temple-lounge" class="wiki-anchor-heading">休息室</h3>
          <ol>
            <li>选择“神殿模式 → 休息室”，配置要释放的 Buff。</li>
            <li>设置防卡移动最短和最长间隔，默认 15–30 分钟适合先测试。</li>
            <li>让角色站在安全、不会碰到传送点的位置，再点击“开始”。</li>
          </ol>
          <p>启动时立即释放一轮；小地图黄点或橙点人数连续两帧确认增加，或自动接受组队成功时，再释放所有启用 Buff。释放后会切换队伍频道发送随机提示；到达防卡间隔时短暂右移再左移。</p>
          <section class="wiki-callout is-warning"><strong>休息室不看 Buff 倒计时触发</strong><p>Buff 到期本身不会释放。只有启动、确认人数增加、自动接受组队成功会触发。</p></section>

          <h3 id="temple-rope" class="wiki-anchor-heading">挂绳组队</h3>
          <ol class="wiki-steps compact">
            <li><span>1</span><div><strong>登录并保存角色名</strong><p>所有参与设备都登录同一账号。在客户端或网页“客户端管理”中为每台设备填写与游戏完全一致的角色名。</p></div></li>
            <li><span>2</span><div><strong>创建队伍</strong><p>进入网页“功能中心 → 客户端管理”，点击“创建队伍”，选择 1–5 个有角色名的客户端，并指定队长。</p></div></li>
            <li><span>3</span><div><strong>保存并执行</strong><p>所选客户端会停止原功能，切换到“神殿模式 · 挂绳组队”，开启自动同意组队。队长创建游戏队伍并依次邀请成员。</p></div></li>
            <li><span>4</span><div><strong>确认进队状态</strong><p>网页会显示队长、已进队、等待进队和离线状态。所有成员都显示“已进队”后再设置老板。</p></div></li>
            <li><span>5</span><div><strong>设置目标老板</strong><p>填写老板角色名并保存。系统等待任一成员 Buff 剩余不超过 10 秒后，由队长开始邀请老板。</p></div></li>
            <li><span>6</span><div><strong>观察协同周期</strong><p>老板进队后全员强制释放已启用 Buff；全部完成后，队长结束本轮并重建原队伍。网页会显示邀请、释放、结束和重建状态。</p></div></li>
          </ol>
          <ul>
            <li>可在网页移除非队长成员，队长客户端会发送踢出指令。</li>
            <li>修改成员或队长并保存后会重建队伍；更换队长时，旧队长先退出原游戏队伍，新队长再建队邀请。</li>
            <li>解散网页队伍时，在线队长会同时尝试退出游戏队伍；队长离线时网页记录仍会直接解散。</li>
            <li>老板邀请流程已在运行时，重复保存同一老板不会启动第二轮。</li>
          </ul>
          <section class="wiki-callout is-danger"><strong>当前能力边界</strong><p>挂绳组队会处理建队、邀请、接受、老板 Buff 周期和队伍重建，但不会自动走到绳索、上绳或掉绳恢复。请先手动把角色放到合适位置。</p></section>

          <h3 id="temple-free" class="wiki-anchor-heading">进出自由</h3>
          <ol>
            <li>选择“神殿模式 → 进出自由”，至少启用一个 Buff。</li>
            <li>设置跳跃键，并选择“先右再左”“只向左”或“只向右”。</li>
            <li>需要时设置椅子键并手动标记自由市场传送门，然后点击“开始”。</li>
          </ol>
          <p>运行流程与死花模式一致，日志中显示“神殿模式 · 进出自由”。传送门标记、窗口大小和识别注意事项也与死花相同。</p>
        </section>

        <section id="follow-heal" class="wiki-section wiki-mode-section">
          <p class="wiki-section-number">07 · FOLLOW HEAL</p><div class="wiki-heading-row"><h2>跟补模式</h2><span class="feature-ready">补血与横向回位</span></div>
          <p>跟补持续按住加血技能，并读取小地图黄点判断角色的横向位置。角色靠近或离开基准区域时，会使用方向键加瞬移进行拟人修正；纵向坐标不参与回位判断。</p>
          <h3>运行前设置</h3>
          <ol>
            <li>选择“加血技能键”和“瞬移技能键”，两者不能相同。</li>
            <li>点击“跟补基准点 → 标记”，在小地图上点选希望角色停留的位置。</li>
            <li>在标记窗口设置左右界限，允许值为 1–50。确认后会同时保存当前小地图区域。</li>
            <li>Buff 可选：需要自动补 Buff 就启用并设置按键、持续时间；只补血也可直接运行。</li>
          </ol>
          <h3>运行后会发生什么</h3>
          <ul>
            <li>加血键每轮持续按住约 8–12 秒，轮次之间短暂等待；启动后会立即开始补血，并处理到期 Buff。</li>
            <li>Buff 到期时立即松开加血键，优先连续按两次释放 Buff，并合并 10 秒内即将到期的 Buff，然后继续补血。</li>
            <li>系统每隔约 4–7 秒做一次独立站位修正。靠近基准点时，会先向外瞬移，短暂停顿后立即瞬移回来，让动作不总是固定在一点。</li>
            <li>达到左右界限的 75% 会提前保护；左侧达到保护线时优先向右强制回位。</li>
            <li>越界后会高频读取黄点并连续修正；短暂识别不到黄点时会继续补血，不会盲目持续走位。</li>
          </ul>
          <section class="wiki-callout is-warning"><strong>基准点失效时重新标记</strong><p>更换窗口、分辨率、UI 比例或游戏小地图大小后，请停止跟补并重新标记。若日志持续提示识别不到黄点，先确认小地图完整可见。</p></section>
        </section>

        <section id="monitor" class="wiki-section wiki-mode-section">
          <p class="wiki-section-number">08 · MONITOR</p><div class="wiki-heading-row"><h2>监控模式</h2><span class="feature-ready">只读画面</span></div>
          <p>监控模式不会发送键盘或鼠标输入。它持续读取游戏小地图与画面，在客户端显示本人、队友、其他玩家、经验、符文、鼠标跟随验证和安全区状态；登录账号后还会同步到网页。</p>
          <h3>启动与显示</h3>
          <ol>
            <li>选择正确游戏窗口并确认屏幕录制权限，切换到“监控模式”。监控不要求启用 Buff，也不要求辅助功能权限。</li>
            <li>选择显示方式：<strong>纯小地图</strong>、<strong>小地图 + 标注</strong>或<strong>纯标注</strong>。</li>
            <li>点击“开始监控”。客户端会显示帧率、玩家坐标、队友数、其他玩家数、经验与风险识别状态。</li>
            <li>登录同一账号打开网页“远程监控”，即可查看当前账号正在运行的监控客户端。</li>
          </ol>
          <h3>地图标注与安全区</h3>
          <ul>
            <li><strong>地图标注：</strong>管理员可在客户端管理地图拓扑或使用网页云端地图管理。匹配成功后，本地与网页会显示地图名称和标注。</li>
            <li><strong>安全区：</strong>停止监控后点击“设置基准点”，在小地图选择中心，再按百分比调整宽度和高度；重新开始后生效。</li>
            <li><strong>风险识别：</strong>画面出现符文提示或鼠标跟随验证时，本地与网页同步状态；安全区越界也会在防抖确认后上报。</li>
            <li><strong>经验统计：</strong>客户端识别当前经验和百分比，网页计算近 10 分钟、近 1 小时、今日、累计收益与增长停滞。</li>
          </ul>
          <section class="wiki-callout is-info"><strong>一个账号同一时间只运行一个监控客户端</strong><p>如果另一台已登录设备已经在运行监控，本机无法再启动；在网页“客户端管理”停止原设备后再启动。网页查看页会自动跟随当前唯一的活动监控会话。</p></section>
          <section class="wiki-callout is-warning"><strong>只读不等于后台仍可输入</strong><p>监控运行时，客户端会暂停自动同意组队等独立输入功能，确保监控期间不主动操作游戏。停止监控后才按原开关恢复。</p></section>
        </section>

        <section id="web-console" class="wiki-section">
          <p class="wiki-section-number">09</p><h2>网页远程功能</h2>
          <div class="wiki-checklist">
            <div><span>远程监控</span><p>查看地图与角色位置、经验收益、增长速率、符文、鼠标跟随验证、安全区和通道诊断。</p></div>
            <div><span>客户端管理</span><p>查看每台已登录设备的在线状态、版本、当前模式和运行状态；可远程开始、停止、保存角色名或解绑设备。</p></div>
            <div><span>挂绳队伍</span><p>创建 1–5 人队伍、指定队长、移除成员、设置老板，并查看进队和老板 Buff 周期状态。</p></div>
            <div><span>Bark 通知</span><p>在“设置”绑定 DeviceKey 后，可开启安全区越界、经验无增长、符文和鼠标跟随验证推送，并发送普通或紧急测试通知。</p></div>
          </div>
          <h3>Bark 设置顺序</h3>
          <ol>
            <li>在 iPhone Bark 中添加网页显示的服务器地址，取得 DeviceKey。</li>
            <li>进入网页“设置”，填写 DeviceKey，保存后先发送普通测试。</li>
            <li>回到“远程监控”按需开启告警。紧急静音只影响符文和鼠标跟随验证的声音，不会关闭事件状态本身。</li>
          </ol>
        </section>

        <section id="troubleshooting" class="wiki-section">
          <p class="wiki-section-number">10</p><h2>常见问题</h2>
          <details open><summary>点击开始没有反应，或启动后马上停止</summary><p>先看客户端底部日志。检查是否选对游戏窗口、账号是否有该模式权限、系统权限是否生效，以及当前模式要求的 Buff、按键、基准点或角色名是否填写完整。</p></details>
          <details><summary>客户端能按键，但按到了其他窗口</summary><p>立即停止。重新选择游戏窗口，并关闭会抢焦点的弹窗或软件。运行中不要主动切换到其他游戏窗口；挂绳组队发送指令前会尝试重新聚焦目标游戏。</p></details>
          <details><summary>死花或进出自由找不到市场出口</summary><p>保持游戏窗口和 UI 比例固定，确认角色确实在自由市场。停止运行后手动标记“自由市场传送门”，再重新开始。</p></details>
          <details><summary>休息室人数增加但没有释放 Buff</summary><p>确认小地图完整可见且没有被遮挡。系统需要连续两帧确认人数增加；首次识别只建立人数基线，短暂出现又消失的人数变化不会触发。</p></details>
          <details><summary>挂绳成员一直显示“等待进队”</summary><p>检查客户端是否在线、角色名是否与游戏完全一致、游戏聊天框能否接收繁体队伍指令、邀请窗口是否被遮挡。换队长或修改成员后请等待网页“重建队伍”状态结束。</p></details>
          <details><summary>跟补持续回位或完全不回位</summary><p>停止后检查小地图黄点是否能识别，并重新标记基准点。界限过小会频繁触发保护，界限过大会让角色偏离更远才修正；建议先用默认值实测。</p></details>
          <details><summary>网页显示客户端在线，但没有监控画面</summary><p>在线只表示账号通道已连接。确认该客户端当前选择“监控模式”且正在运行；一个账号只有一个活动监控会话，必要时在“客户端管理”停止其他设备。</p></details>
          <details><summary>开启 macOS 系统权限后仍显示未授权</summary><p>进入“系统设置 → 隐私与安全性”，确认当前这份 AutoBuff 已勾选，然后完全退出并重新打开。移动或替换 App 文件后，系统可能要求重新授权。</p></details>
        </section>

        <section id="safety" class="wiki-section">
          <p class="wiki-section-number">11</p><h2>使用提醒</h2>
          <ul class="wiki-safe-list">
            <li><strong>第一次先短时间观察。</strong>不要配置完成后立刻长时间离开。</li>
            <li><strong>窗口保持可见且大小固定。</strong>最小化、遮挡或缩放都可能影响图像识别和已标记坐标。</li>
            <li><strong>发现异常先停止。</strong>角色位置、按键或识别不正确时，先停止模式，再修改配置。</li>
            <li><strong>客户端日志是排查入口。</strong>反馈问题时请提供系统平台、客户端版本、所选模式、最后几行日志和网页状态。</li>
          </ul>
        </section>

        <footer class="wiki-footer"><span>AutoBuff 五大模式使用手册</span><a href="#overview">回到顶部 ↑</a></footer>
      </article>
    </div>
  </main>
</template>
