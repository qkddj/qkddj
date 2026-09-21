import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
function api(args) {
  for (let i = 0; i < 3; i++) {
    try { return JSON.parse(execFileSync('gh', ['api', ...args], {encoding:'utf8', stdio:['ignore','pipe','pipe']})); }
    catch (error) { if (i === 2) throw new Error('GitHub API request failed; existing stats were not replaced.'); }
  }
}
const renderOnly = process.argv.includes('--render-only');
let stats;
try { stats = JSON.parse(readFileSync('assets/stats.json', 'utf8')); } catch { stats = {}; }
if (!renderOnly) {
  const response = api(['graphql','-f','query=query { user(login: "qkddj") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }']);
  if (response.errors || !response.data?.user) throw new Error('Invalid calendar response');
  stats.calendar = response.data.user.contributionsCollection.contributionCalendar;
  stats.calendarUpdated = new Date().toISOString().slice(0,10);
  if (!process.argv.includes('--public-only')) {
    const counts = api(['graphql','-f','query=query { prs: search(query: "is:pr author:qkddj", type: ISSUE) { issueCount } reviews: search(query: "is:pr reviewed-by:qkddj -author:qkddj", type: ISSUE) { issueCount } issues: search(query: "is:issue author:qkddj", type: ISSUE) { issueCount } }']);
    const commits = api(['search/commits?q=author:qkddj&per_page=1']);
    if (counts.errors || commits.incomplete_results || !Number.isInteger(commits.total_count)) throw new Error('Incomplete activity response');
    stats.activity = {commits:commits.total_count, prs:counts.data.prs.issueCount, reviews:counts.data.reviews.issueCount, issues:counts.data.issues.issueCount};
    stats.activityUpdated = new Date().toISOString().slice(0,10);
  }
}
if (!stats.calendar || !stats.activity) throw new Error('Missing initial statistics');
const fmt = n => n.toLocaleString('en-US');
const days = stats.calendar.weeks.flatMap(w=>w.contributionDays);
const active = days.filter(d=>d.contributionCount>0).length;
let streak=0, longest=0;
for (const day of days) { streak = day.contributionCount ? streak+1 : 0; longest=Math.max(longest,streak); }
const peak = Math.max(...days.map(d=>d.contributionCount));
const cards = [['COMMITS',stats.activity.commits,'Indexed commits'],['PULL REQUESTS',stats.activity.prs,'Authored PRs'],['CODE REVIEW',stats.activity.reviews,'PRs reviewed · excluding own'],['ISSUES',stats.activity.issues,'Authored issues']];
const cardSvg = cards.map(([label,value,note],i)=>{
  const x=44+i*233;
  return `<rect x="${x}" y="296" width="218" height="134" rx="14" fill="#131c2b" stroke="#263348"/><text x="${x+20}" y="326" class="label">${label}</text><text x="${x+20}" y="375" class="value">${fmt(value)}</text><text x="${x+20}" y="406" class="note">${note}</text>`;
}).join('');
const colors=['#182435','#17443f','#1d7061','#28a889','#64e1bd'];
const heatmap=stats.calendar.weeks.map((week,x)=>week.contributionDays.map(day=>{
  const row=new Date(day.date+'T00:00:00Z').getUTCDay();
  const c=day.contributionCount;
  const level=c===0?0:c<5?1:c<15?2:c<30?3:4;
  return `<rect x="${47+x*17}" y="521" width="12" height="12" rx="3" fill="${colors[level]}" transform="translate(0 ${row*17})"><title>${day.date}: ${c} contributions</title></rect>`;
}).join('')).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="736" viewBox="0 0 1000 736" role="img" aria-labelledby="title desc">
<title id="title">qkddj — GitHub activity</title><desc id="desc">${fmt(stats.calendar.totalContributions)} contributions in the last year. ${cards.map(([label,n])=>`${fmt(n)} ${label}`).join(', ')}. Activity totals verified ${stats.activityUpdated}.</desc>
<defs><radialGradient id="glow" cx="95%" cy="0%" r="75%"><stop stop-color="#153a40"/><stop offset="1" stop-color="#0d1420"/></radialGradient></defs>
<style>text{font-family:Inter,Segoe UI,Arial,sans-serif;fill:#eaf0f7}.label{font-size:11px;letter-spacing:1.7px;fill:#a5b4c8}.note{font-size:11px;fill:#8b9db4}.value{font-size:39px;font-weight:650;letter-spacing:-1.5px}</style>
<rect x="1" y="1" width="998" height="734" rx="24" fill="url(#glow)" stroke="#263348"/>
<circle cx="50" cy="48" r="4" fill="#64e1bd"/><text x="65" y="53" class="label">QKDDJ / ACTIVITY LOG</text><text x="954" y="53" text-anchor="end" class="note">GITHUB PROFILE</text>
<text x="44" y="151" font-size="82" font-weight="700" letter-spacing="-4">${fmt(stats.calendar.totalContributions)}<tspan font-size="25" fill="#64e1bd" dx="18" letter-spacing="0">contributions</tspan></text>
<text x="48" y="190" font-size="18" fill="#a5b4c8">in the last year.</text>
<text x="48" y="222" class="note">${days[0].date} — ${days.at(-1).date} · Includes private contribution counts</text>
<line x1="44" y1="254" x2="956" y2="254" stroke="#263348"/>
<text x="44" y="280" class="label">LIFETIME ACTIVITY</text><text x="956" y="280" text-anchor="end" class="note">Verified ${stats.activityUpdated}</text>
${cardSvg}
<text x="44" y="480" class="label">A YEAR IN SMALL STEPS</text><text x="956" y="480" text-anchor="end" class="note">${active} active days · ${longest}-day longest streak · ${peak} best day</text>
${heatmap}
<text x="47" y="662" class="note">${days[0].date}</text><text x="940" y="662" text-anchor="end" class="note">${days.at(-1).date}</text>
<line x1="44" y1="686" x2="956" y2="686" stroke="#263348"/>
<text x="44" y="711" class="note">Build. Review. Iterate.</text><text x="956" y="711" text-anchor="end" class="note">Calendar updated ${stats.calendarUpdated} UTC</text></svg>`;
mkdirSync('assets',{recursive:true});
writeFileSync('assets/activity.svg',svg);
writeFileSync('assets/stats.json',JSON.stringify(stats,null,2)+'\n');
console.log(JSON.stringify({contributions:stats.calendar.totalContributions,...stats.activity,activeDays:active,longestStreak:longest,peak}));
