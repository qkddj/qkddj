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
  const response = api(['graphql','-f','query=query { user(login: "qkddj") { repositories(first:100, privacy:PUBLIC, ownerAffiliations:OWNER, isFork:false) { totalCount pageInfo { hasNextPage } nodes { stargazerCount forkCount languages(first:100) { edges { size node { name color } } } } } contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }']);
  if (response.errors || !response.data?.user) throw new Error('Invalid calendar response');
  stats.calendar = response.data.user.contributionsCollection.contributionCalendar;
  stats.calendarUpdated = new Date().toISOString().slice(0,10);
  const repos = response.data.user.repositories;
  if (repos.pageInfo.hasNextPage) throw new Error('Repository pagination required');
  const languages = {};
  for (const repo of repos.nodes) for (const edge of repo.languages.edges) {
    languages[edge.node.name] ??= {name:edge.node.name, color:edge.node.color || '#777777', size:0};
    languages[edge.node.name].size += edge.size;
  }
  stats.public = {repos:repos.totalCount, stars:repos.nodes.reduce((n,r)=>n+r.stargazerCount,0), forks:repos.nodes.reduce((n,r)=>n+r.forkCount,0), languages:Object.values(languages).sort((a,b)=>b.size-a.size)};
  if (!process.argv.includes('--public-only')) {
    const counts = api(['graphql','-f','query=query { prs: search(query: "is:pr author:qkddj", type: ISSUE) { issueCount } reviews: search(query: "is:pr reviewed-by:qkddj -author:qkddj", type: ISSUE) { issueCount } issues: search(query: "is:issue author:qkddj", type: ISSUE) { issueCount } }']);
    const commits = api(['search/commits?q=author:qkddj&per_page=1']);
    if (counts.errors || commits.incomplete_results || !Number.isInteger(commits.total_count)) throw new Error('Incomplete activity response');
    stats.activity = {commits:commits.total_count, prs:counts.data.prs.issueCount, reviews:counts.data.reviews.issueCount, issues:counts.data.issues.issueCount};
    stats.activityUpdated = new Date().toISOString().slice(0,10);
  }
}
if (!stats.calendar || !stats.activity) throw new Error('Missing initial statistics');
const { render } = await import('./render.mjs');
mkdirSync('assets', {recursive:true});
writeFileSync('assets/activity.svg', render(stats));
writeFileSync('assets/stats.json', JSON.stringify(stats,null,2)+'\n');
console.log(JSON.stringify({contributions:stats.calendar.totalContributions,...stats.activity}));
