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
        <div class="wiki-sidebar-title"><span>?</span><div><strong>使用手册</strong><small>新手入门指南</small></div></div>
        <nav>
          <p>神殿模式</p>
          <a href="#start">开始前准备</a>
          <a href="#choose">选择合适的功能</a>
          <a href="#lounge">休息室</a>
          <a href="#rope-party">挂绳组队</a>
          <a href="#free-entry">进出自由</a>
          <a href="#running">开始与停止</a>
          <a href="#troubleshooting">常见问题</a>
          <a href="#safety">使用提醒</a>
        </nav>
        <div class="wiki-side-note"><strong>第一次使用？</strong><span>建议从“开始前准备”按顺序阅读，约 5 分钟。</span></div>
      </aside>

      <article class="wiki-article">
        <div class="wiki-breadcrumb">使用手册 <span>/</span> 模式教程 <span>/</span> 神殿模式</div>
        <header class="wiki-title">
          <div><p class="portal-kicker">TEMPLE MODE</p><h1>神殿模式使用教程</h1></div>
          <span class="wiki-status">适合第一次使用</span>
        </header>
        <p class="wiki-intro">神殿模式是给时间神殿地图准备的一组自动功能。你只需要先选好游戏窗口、设置要释放的 Buff，再根据自己的场景选择“休息室”“挂绳组队”或“进出自由”。</p>

        <section class="wiki-callout is-info">
          <strong>先记住这一点</strong>
          <p>三种功能一次只能选择一种。运行中不能改设置；如需调整，请先点击“停止”。</p>
        </section>

        <section id="start" class="wiki-section">
          <p class="wiki-section-number">01</p><h2>开始前准备</h2>
          <p>第一次使用时，按下面顺序检查。完成一项再做下一项，最不容易出错。</p>
          <ol class="wiki-steps">
            <li><span>1</span><div><strong>登录客户端</strong><p>打开 AutoBuff 客户端，登录与你当前网页相同的账号。</p></div></li>
            <li><span>2</span><div><strong>打开游戏并保持窗口可见</strong><p>建议使用窗口模式或无边框窗口模式，不要最小化游戏。进入准备使用功能的角色。</p></div></li>
            <li><span>3</span><div><strong>选择游戏窗口</strong><p>在客户端顶部点击“识别窗口”或窗口选择按钮，确认状态栏显示的是正确游戏窗口。</p></div></li>
            <li><span>4</span><div><strong>授予系统权限</strong><p>按客户端提示开启“辅助功能”和“屏幕录制”。开启后若仍提示未授权，请完全退出客户端再重新打开。</p></div></li>
            <li><span>5</span><div><strong>配置 Buff</strong><p>在 Buff 槽位中打开需要使用的项目，选择正确按键并填写持续时间。请先在游戏里手动按一次，确认按键有效。</p></div></li>
            <li><span>6</span><div><strong>选择神殿模式</strong><p>在客户端的模式区域点击“神殿模式”，然后在“神殿功能”中选择具体功能。</p></div></li>
          </ol>
        </section>

        <section id="choose" class="wiki-section">
          <p class="wiki-section-number">02</p><h2>我应该选哪个功能？</h2>
          <div class="wiki-choice-grid">
            <article><span>人数变化时补 Buff</span><h3>休息室</h3><p>适合留在神殿休息室，队友或玩家进入后自动释放一轮 Buff，并发送队伍消息。</p><a href="#lounge">查看步骤 →</a></article>
            <article><span>多台客户端统一建队</span><h3>挂绳组队</h3><p>适合在网页为多个角色建队，自动发送建队、邀请和接受邀请指令。</p><a href="#rope-party">查看步骤 →</a></article>
            <article><span>定时进出自由市场</span><h3>进出自由</h3><p>适合按 Buff 倒计时进出自由市场，并在回到地图后自动释放 Buff。</p><a href="#free-entry">查看步骤 →</a></article>
          </div>
        </section>

        <section id="lounge" class="wiki-section">
          <p class="wiki-section-number">03</p><div class="wiki-heading-row"><h2>休息室</h2><span class="feature-ready">已实现 · 建议先实测</span></div>
          <p>这个功能会观察小地图上的人数。点击开始时先释放一轮 Buff；之后确认人数增加，或自动接受组队成功时，再释放全部已启用的 Buff。</p>
          <h3>设置方法</h3>
          <ol>
            <li>在客户端选择“神殿模式” → “休息室”。</li>
            <li>把“防卡移动间隔”保留为默认的 <strong>15 至 30 分钟</strong>；新手不建议一开始修改。</li>
            <li>确认 Buff 槽位的开关、按键和持续时间都已填写。</li>
            <li>让角色站在休息室中一个安全、不会碰到传送点的位置。</li>
            <li>点击“开始”。看到日志出现“神殿模式 · 休息室启动”即表示已经运行。</li>
          </ol>
          <h3>运行后会发生什么</h3>
          <ul>
            <li>启动后立即释放一轮 Buff。</li>
            <li>小地图人数增加并连续确认两次后，释放所有已启用 Buff。</li>
            <li>释放结束后切到队伍频道，并随机发送一条完成提示。</li>
            <li>到达随机防卡间隔后，角色会短暂向右、再向左移动。</li>
          </ul>
          <section class="wiki-callout is-warning"><strong>注意</strong><p>Buff 倒计时结束本身不会触发释放。休息室模式只在“启动、人数增加、自动接受组队成功”时释放。</p></section>
        </section>

        <section id="rope-party" class="wiki-section">
          <p class="wiki-section-number">04</p><div class="wiki-heading-row"><h2>挂绳组队</h2><span class="feature-progress">第一阶段</span></div>
          <p>这个功能从网页的“客户端管理”统一配置队伍。队长会自动建队并依次邀请队员，队员端会自动接受邀请。</p>
          <h3>设置方法</h3>
          <ol class="wiki-steps compact">
            <li><span>1</span><div><strong>让所有客户端上线</strong><p>每个角色都登录同一个网页账号，并保持客户端在线。网页右上角的在线数量应与准备组队的设备数一致。</p></div></li>
            <li><span>2</span><div><strong>填写角色名称</strong><p>打开网页“功能中心” → “客户端管理”，在每台设备卡片里填写游戏角色名并保存。必须与游戏中的名字完全一致。</p></div></li>
            <li><span>3</span><div><strong>创建队伍</strong><p>点击“创建队伍”，勾选 1–5 个客户端，并从已选角色中指定一名队长。</p></div></li>
            <li><span>4</span><div><strong>保存并执行</strong><p>点击“保存并执行”。所选客户端会停止原功能，切换到“神殿模式 · 挂绳组队”，开启自动同意组队并开始运行。</p></div></li>
            <li><span>5</span><div><strong>查看入队状态</strong><p>网页的“挂绳队伍”会显示“队长 / 已进队 / 等待进队”。所有队员显示“已进队”后，建队完成。</p></div></li>
          </ol>
          <section class="wiki-callout is-danger"><strong>当前能力边界</strong><p>目前会自动建队、邀请和接受邀请，但<strong>还不会自动走到绳索、上绳或掉绳恢复</strong>。请先手动把角色放到合适位置。修改已有队伍时也不会自动重建和补发邀请；需要重建时，建议重新创建队伍。</p></section>
          <p class="wiki-platform-note"><strong>Windows 用户：</strong>目前 Windows 客户端仅补齐了挂绳组队；“休息室”和“进出自由”尚未提供完整执行逻辑。</p>
        </section>

        <section id="free-entry" class="wiki-section">
          <p class="wiki-section-number">05</p><h2>进出自由</h2>
          <p>这个功能会等待 Buff 到期，然后从当前地图进入自由市场；在市场中找到出口，回到原地图后移动到安全位置并释放 Buff。</p>
          <h3>设置方法</h3>
          <ol>
            <li>选择“神殿模式” → “进出自由”。</li>
            <li>设置跳跃键，并按地图选择出市场后的移动方式：<strong>先右再左、只向左或只向右</strong>。</li>
            <li>如自动识别自由市场传送门不稳定，点击“自由市场传送门”进行手动标记。</li>
            <li>确认至少有一个 Buff 已启用、已选按键并填写持续时间。</li>
            <li>把角色放在能安全进入自由市场的位置，点击“开始”。</li>
          </ol>
          <section class="wiki-callout is-info"><strong>传送门标记</strong><p>手动标记会优先于自动识别。改变游戏窗口大小、分辨率或 UI 比例后，建议重新标记一次。</p></section>
        </section>

        <section id="running" class="wiki-section">
          <p class="wiki-section-number">06</p><h2>开始、观察与停止</h2>
          <div class="wiki-checklist">
            <div><span>开始前</span><p>游戏窗口正确、权限正常、角色位置安全、按键配置正确。</p></div>
            <div><span>运行中</span><p>观察客户端日志 1–2 分钟，确认没有重复报错，也没有按错技能或方向。</p></div>
            <div><span>要离开时</span><p>先回到客户端点击“停止”，确认按钮和日志都显示已停止，再关闭游戏或客户端。</p></div>
          </div>
        </section>

        <section id="troubleshooting" class="wiki-section">
          <p class="wiki-section-number">07</p><h2>常见问题</h2>
          <details open><summary>点击开始没有反应，或马上停止</summary><p>先看客户端底部日志。最常见原因是未选择游戏窗口、辅助功能或屏幕录制未授权、没有可用 Buff，或配置的按键为空。</p></details>
          <details><summary>休息室有人进入，但没有释放 Buff</summary><p>确认游戏小地图完整可见且未被遮挡。系统需要连续两次确认人数增加；短暂出现又消失的人数变化不会触发。首次识别只建立人数基线，也不会额外触发。</p></details>
          <details><summary>队员一直显示“等待进队”</summary><p>检查所有客户端是否在线、角色名是否与游戏完全一致、队长聊天框是否能正常输入中文命令，以及邀请窗口是否被其他界面遮挡。必要时停止所有客户端后重新创建队伍。</p></details>
          <details><summary>进出自由找不到传送门</summary><p>保持游戏窗口大小固定，确认角色确实在自由市场。然后停止运行，使用“自由市场传送门”手动标记出口，再重新开始。</p></details>
          <details><summary>开启系统权限后仍显示未授权</summary><p>在 macOS“系统设置 → 隐私与安全性”中确认 AutoBuff 已勾选，然后完全退出并重新打开客户端。更换客户端文件位置后，系统可能要求重新授权。</p></details>
        </section>

        <section id="safety" class="wiki-section">
          <p class="wiki-section-number">08</p><h2>使用提醒</h2>
          <ul class="wiki-safe-list">
            <li><strong>第一次先短时间观察。</strong>不要配置完成后立刻长时间离开。</li>
            <li><strong>窗口保持可见且大小固定。</strong>最小化、遮挡或缩放都可能影响图像识别。</li>
            <li><strong>随时可以停止。</strong>发现角色位置、按键或识别不对时，先点击“停止”，再处理问题。</li>
            <li><strong>客户端日志是排查入口。</strong>反馈问题时，请同时提供所选功能、系统平台和最后几行日志。</li>
          </ul>
        </section>

        <footer class="wiki-footer"><span>神殿模式教程</span><a href="#start">回到顶部 ↑</a></footer>
      </article>
    </div>
  </main>
</template>
