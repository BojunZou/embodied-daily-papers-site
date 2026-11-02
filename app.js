const $ = selector => document.querySelector(selector);
const params = new URL(location.href).searchParams;
const make = (tag, text, className) => {const element = document.createElement(tag); if(text !== undefined) element.textContent = text; if(className) element.className = className; return element;};
const safeExternal = url => {try {const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : null;} catch {return null;}};
const paperURL = id => `./reader.html?${new URLSearchParams({id, from: location.search})}`;
function link(text, href, className, external = false) {const a = make('a', text, className); a.href = href; if(external) {a.target = '_blank'; a.rel = 'noopener noreferrer';} return a;}
const dayLabel = day => new Intl.DateTimeFormat('zh-CN', {month:'long',day:'numeric',weekday:'long',timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
const complete = p => p.summary && p.slides?.length && p.downloads?.pptx && p.downloads?.pdf;
async function load() {const response = await fetch('./data/catalog.json'); if(!response.ok) throw Error('暂时无法加载论文，请稍后刷新。'); const data = await response.json(); if(data.version !== 1 || !Array.isArray(data.papers)) throw Error('论文数据暂时不可用。'); data.papers = data.papers.filter(complete); return data;}
function cards(papers, popular = false) {
  $('#papers').replaceChildren();
  papers.forEach((p, index) => {
    const card = make('article', undefined, 'paper-card'); card.append(make('span', String(index + 1).padStart(2,'0'), 'paper-number'));
    const body = make('div', undefined, 'paper-content'); const meta = make('div', undefined, 'paper-meta');
    meta.append(make('span', `arXiv ${p.id}`));
    if(popular) meta.append(make('span', `↑ ${p.likes ?? 0} HF 点赞`, 'likes'));
    else meta.append(make('span', `${p.slides.length} 页解读`));
    const heading = make('h3'); heading.append(link(p.title, paperURL(p.id))); body.append(meta, heading, make('p', p.summary, 'paper-summary'));
    const open = link('↗', paperURL(p.id), 'paper-open'); open.setAttribute('aria-label', `阅读 ${p.title} 的幻灯片`); card.append(body,open); $('#papers').append(card);
  });
  $('#paper-count').textContent = `${papers.length} 篇论文`;
  $('#status').textContent = papers.length ? '' : '这个时间范围内暂时没有已发布的论文解读。';
}
function home(data) {
  const popular = params.get('view') === 'popular';
  $(popular ? '#nav-popular' : '#nav-daily').setAttribute('aria-current','page');
  if(data.last_checked_at) $('#updated-at').textContent = `更新于 ${new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:data.timezone || 'Asia/Shanghai',hour12:false}).format(new Date(data.last_checked_at))} · 北京时间`;
  if(popular) {
    document.title = '热门论文 · 具身论文日报'; $('#page-title').textContent = '值得再读一遍的研究。'; $('#page-description').textContent = '近一周与近一月，具身智能研究的社区热度。'; $('#issue-label').textContent = 'POPULAR PAPERS';
    $('#publication-note').textContent = '按本站在所选时间范围内收录的论文排序，热度指标为 Hugging Face 当前累计点赞数。';
    let days = params.get('days') === '30' ? 30 : 7;
    const buttons = [];
    function refresh() {
      const today = new Intl.DateTimeFormat('sv-SE',{timeZone:data.timezone || 'Asia/Shanghai'}).format(new Date());
      const end = new Date(`${today}T12:00:00Z`); const start = new Date(end); start.setUTCDate(start.getUTCDate() - days + 1); const minimum = start.toISOString().slice(0,10);
      $('#edition-title').textContent = days === 7 ? '近 7 天热门' : '近 30 天热门';
      const papers = data.papers.filter(p => p.hf_dates.some(day => day >= minimum && day <= today)).sort((a,b) => (b.likes || 0) - (a.likes || 0) || a.id.localeCompare(b.id)).slice(0,12);
      buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.days) === days))); cards(papers,true);
    }
    [7,30].forEach(value => {const button = make('button', `近 ${value} 天`, 'period-button'); button.type='button'; button.dataset.days=String(value); button.onclick=()=>{days=value; const u=new URL(location.href);u.searchParams.set('days',String(days)); history.replaceState(null,'',u); refresh();}; buttons.push(button); $('#controls').append(button);}); refresh();
  } else {
    const dates = [...new Set(data.papers.flatMap(p=>p.hf_dates))].sort().reverse();
    const requested = params.get('date');
    const selected = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && !Number.isNaN(Date.parse(`${requested}T12:00:00Z`)) ? requested : dates[0]; const select = make('select'); select.setAttribute('aria-label','选择日报日期');
    dates.forEach(date => {const option=make('option',`${date === dates[0] ? '最近一期 · ' : ''}${date}`);option.value=date;select.append(option);});
    if(dates.includes(selected)) select.value=selected;
    select.onchange=()=>{const u=new URL(location.href);u.searchParams.set('date',select.value);location.assign(u);};
    if(dates.length) $('#controls').append(select);
    $('#edition-title').textContent = selected ? dayLabel(selected) : '最近一期';
    cards(data.papers.filter(p=>p.hf_dates.includes(selected)));
    if(!dates.length) $('#status').textContent = '首期论文解读正在准备，完成后会在这里更新。';
    $('#publication-note').textContent = '依据 Hugging Face Daily Papers 筛选具身智能论文。日期按 HF 日报收录日期归档；没有新论文时显示最近一期。';
    if(selected && !dates.includes(selected)) $('#status').textContent = '这一天暂无已发布的论文解读，可选择其他日期。';
  }
}
function reader(data) {
  const paper = data.papers.find(p=>p.id === params.get('id'));
  if(!paper) {$('#reader-title').textContent='暂未找到这篇论文';$('#reader-summary').textContent='请返回列表，选择已经发布的论文。';$('#reader-note').hidden=true;return;}
  document.title = `${paper.title} · 具身论文日报`; $('#reader-title').textContent=paper.title; $('#reader-summary').textContent=paper.summary; $('#reader-meta').textContent=`PAPER READING / arXiv ${paper.id}`;
  const from = params.get('from'); if(from !== null && (from === '' || from.startsWith('?'))) $('#back').href=`./${from}`;
  [['论文原文 ↗',paper.arxiv_url],['HF 讨论 ↗',paper.hf_url],['下载 PPTX ↓',paper.downloads.pptx,'primary'],['下载 PDF ↓',paper.downloads.pdf]].forEach(([title,url,className])=>{const href=safeExternal(url);if(href) $('#reader-links').append(link(title,href,className,true));});
  let current = 0;
  function show() {
    const source=paper.slides[current]; const url=new URL(source,location.href); const expected=new URL(`./slides/${paper.id}/`,location.href);
    if(url.origin !== expected.origin || !url.pathname.startsWith(expected.pathname)) throw Error('幻灯片地址无效。');
    $('#slide').src=url.href;$('#slide').alt=`${paper.title}，第 ${current+1} 页`;$('#slide-counter').textContent=`${current+1} / ${paper.slides.length}`;$('#previous').disabled=current===0;$('#next').disabled=current===paper.slides.length-1;
    if(current+1 < paper.slides.length) {const image=new Image();image.src=paper.slides[current+1];}
  }
  $('#previous').onclick=()=>{if(current>0) {current--;show();}}; $('#next').onclick=()=>{if(current<paper.slides.length-1) {current++;show();}};
  document.addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select,button,a') || event.altKey || event.ctrlKey || event.metaKey) return; if(event.key==='ArrowRight') {event.preventDefault();$('#next').click();} if(event.key==='ArrowLeft') {event.preventDefault();$('#previous').click();}});
  $('#fullscreen').hidden=!document.fullscreenEnabled;$('#fullscreen').onclick=()=>$('#slide-stage').requestFullscreen().catch(()=>{});
  $('#slide').onerror=()=>{$('#reader-note').textContent='幻灯片图片暂时无法加载，可先下载 PDF 或 PPTX 阅读。';};
  $('#slide-reader').hidden=false;show();
}
try {const data=await load();document.body.dataset.page==='reader' ? reader(data) : home(data);} catch(error) {if($('#status')) $('#status').textContent=error.message;if($('#reader-title')) $('#reader-title').textContent=error.message;}
