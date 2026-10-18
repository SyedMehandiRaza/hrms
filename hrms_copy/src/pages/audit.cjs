const fs = require('fs');
const path = require('path');
const dir = 'e:/Project-Fyinder/fyinder-hrms-new-reactjs/src/pages';
const walkSync = (d) => {
  let list = [];
  fs.readdirSync(d).forEach(file => {
    const full = path.join(d, file);
    if (fs.statSync(full).isDirectory()) list = list.concat(walkSync(full));
    else if (full.endsWith('.jsx')) list.push(full);
  });
  return list;
};
const files = walkSync(dir);
const results = [];
for (let f of files) {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('<table') || content.includes('.map(')) {
    const hasPaginationUI = (content.includes('Showing') && content.includes('ChevronLeft')) || content.includes('Pagination');
    const hasPageState = content.includes('const [page, setPage]');
    const hasFilterUI = content.includes('<CustomDropdown') || content.includes('status') || content.includes('Status') || content.includes('filter');
    const hasSearchUI = content.includes('placeholder="Search') || content.includes('placeholder="Filter');
    
    let issues = [];
    if (!hasPaginationUI) issues.push('Missing Pagination UI');
    if (!hasPageState) issues.push('Missing Pagination State/API hook');
    if (!hasFilterUI) issues.push('Missing Filter UI');
    if (!hasSearchUI) issues.push('Missing Search UI');
    
    // Ignore small dashboard-like map loops that don't need pagination, typically characterized by not having <table> or being very short.
    if (issues.length > 0 && content.includes('<table')) {
      results.push({
        file: f.replace(dir, ''),
        issues: issues
      });
    }
  }
}
console.log(JSON.stringify(results, null, 2));
