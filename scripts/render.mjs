export function render(stats) {
  const fmt = n => n.toLocaleString('en-US');
  const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const days = stats.calendar.weeks.flatMap(w=>w.contributionDays);
  const peak = Math.max(1,...days.map(d=>d.contributionCount));
  const point = (x,y) => `${x.toFixed(2)},${y.toFixed(2)}`;
  // Week moves southeast, weekday southwest. Draw far tiles first.
  const tiles = [];
  stats.calendar.weeks.forEach((w,week)=>w.contributionDays.forEach(day=>{
    const row = new Date(day.date+'T00:00:00Z').getUTCDay();
    tiles.push({week,row,...day});
  }));
  const step = 21, half = 11, rise = 10.6, originX = 180, originY = 200;
  const blocks = tiles.sort((a,b)=>(a.week+a.row)-(b.week+b.row)||a.week-b.week).map(d=>{
    const x=originX+(d.week-d.row)*step, y=originY+(d.week+d.row)*rise;
    const c=d.contributionCount;
    const h=c?7+Math.sqrt(c/peak)*142:3;
    const l=c?29+Math.sqrt(c/peak)*30:23;
    const top=c?`hsl(127,61%,${l}%)`:'#32383e';
    const left=c?`hsl(128,61%,${l*.7}%)`:'#242930';
    const right=c?`hsl(129,61%,${l*.84}%)`:'#2a3037';
    const a=[x,y-h],b=[x+step-1,y+half-h],cc=[x,y+2*half-h],dd=[x-step+1,y+half-h];
    return `<g><title>${d.date}: ${c} contributions</title><polygon points="${[dd,cc,[x,y+2*half],[x-step+1,y+half]].map(p=>point(...p)).join(' ')}" fill="${left}"/><polygon points="${[cc,b,[x+step-1,y+half],[x,y+2*half]].map(p=>point(...p)).join(' ')}" fill="${right}"/><polygon points="${[a,b,cc,dd].map(p=>point(...p)).join(' ')}" fill="${top}"/></g>`;
  }).join('');
  const axes=[['Commit',stats.activity.commits],['Issue',stats.activity.issues],['PullReq',stats.activity.prs],['Review',stats.activity.reviews],['Repo',stats.public.repos]];
  const cx=1070,cy=279,r=155;
  const polar=(i,f)=>[cx+Math.sin(i*Math.PI*2/5)*r*f,cy-Math.cos(i*Math.PI*2/5)*r*f];
  const polygon=f=>axes.map((_,i)=>point(...polar(i,f))).join(' ');
  const rings=[.25,.5,.75,1].map((f,i)=>`<polygon points="${polygon(f)}" class="grid"/><text x="${cx+7}" y="${cy-r*f-5}" class="small">${['10','100','1K','10K'][i]}</text>`).join('');
  const spokes=axes.map(([name,n],i)=>{
    const [x,y]=polar(i,1.24);
    return `<path d="M${cx},${cy} L${point(...polar(i,1))}" class="grid"/><text x="${x}" y="${y-4}" text-anchor="middle" font-size="22">${name}</text><text x="${x}" y="${y+19}" text-anchor="middle" class="small" fill="#7de783">${fmt(n)}</text>`;
  }).join('');
  const radar=axes.map(([,n],i)=>point(...polar(i,Math.min(1,Math.log10(Math.max(1,n))/4)))).join(' ');
  const languages=stats.public.languages.slice(0,5);
  if(stats.public.languages.length>5) languages.push({name:'Other',color:'#666b72',size:stats.public.languages.slice(5).reduce((n,l)=>n+l.size,0)});
  const total=languages.reduce((n,l)=>n+l.size,0);
  let offset=0;
  const radius=87, circumference=2*Math.PI*radius;
  const donut=languages.map(l=>{
    const length=total?l.size/total*circumference:0;
    const segment=`<circle cx="193" cy="654" r="${radius}" fill="none" stroke="${esc(l.color)}" stroke-width="44" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 193 654)"/>`;
    offset+=length; return segment;
  }).join('');
  const legend=languages.map((l,i)=>`<rect x="335" y="${578+i*32}" width="18" height="18" fill="${esc(l.color)}"/><text x="365" y="${594+i*32}" font-size="20">${esc(l.name)} <tspan class="small">${(l.size/total*100).toFixed(1)}%</tspan></text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="940" viewBox="0 0 1400 940" role="img" aria-labelledby="title desc">
<title id="title">qkddj — 3D contribution skyline</title><desc id="desc">${fmt(stats.calendar.totalContributions)} contributions in the last year. Lifetime indexed commits ${fmt(stats.activity.commits)}, authored PRs ${fmt(stats.activity.prs)}, reviewed PRs ${fmt(stats.activity.reviews)}, issues ${fmt(stats.activity.issues)}. Public repositories ${stats.public.repos}. Languages from public repository code bytes.</desc>
<style>text{font-family:Segoe UI,Arial,sans-serif;fill:#e9eaf5}.small{font-size:14px;fill:#98a4b7}.grid{fill:none;stroke:#687381;stroke-width:1;stroke-dasharray:4 5}</style>
<rect width="1400" height="940" fill="#030310"/>
<text x="40" y="43" class="small" letter-spacing="3">QKDDJ / CONTRIBUTION SKYLINE</text>
<text x="1360" y="43" text-anchor="end" font-size="18" fill="#98a4b7">${days[0].date} / ${days.at(-1).date}</text>
${blocks}
${rings}${spokes}<polygon points="${radar}" fill="#61d551" fill-opacity=".35" stroke="#65c858" stroke-width="4"/>
<text x="1070" y="506" text-anchor="middle" class="small">Lifetime activity · log scale · Repo: public only</text>
<text x="1070" y="528" text-anchor="middle" class="small">Verified ${stats.activityUpdated}</text>
${donut}${legend}
<text x="193" y="650" text-anchor="middle" font-size="24" font-weight="600">Languages</text><text x="193" y="676" text-anchor="middle" class="small">public code</text>
<text x="86" y="798" class="small">Language share by bytes · public repositories only</text>
<text x="350" y="888" font-size="36" font-weight="700" fill="#ffd333" style="fill:#ffd333">${fmt(stats.calendar.totalContributions)}<tspan font-size="25" font-weight="400" fill="#e9eaf5"> contributions</tspan></text>
<text x="850" y="888" font-size="28">☆ ${stats.public.stars} <tspan dx="30">⑂ ${stats.public.forks}</tspan></text>
<text x="350" y="918" class="small">Last year · includes private contribution counts</text><text x="850" y="918" class="small">Public stars / forks</text>
</svg>`;
}
