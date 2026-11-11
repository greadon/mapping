export function coordinates(location) {
  const values = [location.latitude,location.longitude];
  if (values.some(value => value == null || String(value).trim() === '')) return null;
  const [lat,lon] = values.map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180 ? [lat,lon] : null;
}
export function locationSummary(location, stageId, allocations, roles = []) {
  const matches = allocations.filter(row => String(row.stageId) === String(stageId) && String(row.locationId) === String(location.locationId));
  const accepted = matches.filter(row => row.personId && row.invitationStatus !== 'Invited');
  const roleIds = new Set([...(location.requirements||[]).map(row=>String(row.roleId)),...matches.map(row=>String(row.roleId))]);
  const requirements = [...roleIds].map(roleId => {
    const requirement = (location.requirements||[]).find(row=>String(row.roleId)===roleId);
    const people = [...new Map(accepted.filter(row=>String(row.roleId)===roleId).map(row=>[String(row.personId),row])).values()];
    const required = Number(requirement?.minimumQty || 0);
    return {roleId,name:roles.find(row=>String(row.roleId)===roleId)?.name || matches.find(row=>String(row.roleId)===roleId)?.roleName || `Role ${roleId}`,required,people,shortfall:Math.max(0,required-people.length)};
  });
  const shortfall = requirements.reduce((sum,row)=>sum+row.shortfall,0);
  const specified = (location.requirements||[]).some(row=>Number(row.minimumQty)>0);
  return {requirements,shortfall,allocated:new Set(accepted.map(row=>String(row.personId))).size,pending:matches.filter(row=>row.invitationStatus==='Invited').length,status:shortfall?'short':specified?'covered':'unspecified'};
}
