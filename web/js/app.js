(async function(){
  // Load each view's HTML from its own file and inject it into the shared
  // <main> containers before anything else runs, so every element lookup
  // below still finds what it expects (behavior unchanged, just where the
  // markup physically lives).
  async function loadViewFragments(){
    const appViews = ['scan', 'history', 'reports', 'admin', 'account'];
    const saViews = ['sa-dashboard', 'sa-pharmacies', 'sa-company-detail', 'sa-payments', 'sa-activity', 'sa-admins'];
    const [appHtml, saHtml] = await Promise.all([
      Promise.all(appViews.map(v => fetch('views/' + v + '.html').then(r => r.text()))),
      Promise.all(saViews.map(v => fetch('views/' + v + '.html').then(r => r.text()))),
    ]);
    document.getElementById('app-main').innerHTML = appHtml.join('\n');
    document.getElementById('sa-main').innerHTML = saHtml.join('\n');
  }
  await loadViewFragments();

  // ---- Point this at your deployed backend (see /backend/README.md) ----
  const BACKEND_URL = 'https://zewin-rx-scan.vercel.app';
  const LOGO_DATA_URI = 'data:image/png;base64,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';

  let token = localStorage.getItem('rxscan_token') || null;
  let currentUser = null;

  const $ = (id) => document.getElementById(id);
  const loginScreen = $('login-screen');
  const appScreen = $('app-screen');
  const superadminScreen = $('superadmin-screen');

  async function api(path, options) {
    options = options || {};
    const headers = Object.assign({'Content-Type':'application/json'}, options.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(BACKEND_URL + path, Object.assign({}, options, { headers }));
    if (res.status === 401) {
      logout();
      throw new Error('unauthorized');
    }
    if (!res.ok) {
      let body = {};
      try { body = await res.json(); } catch(e){}
      throw Object.assign(new Error(body.error || 'request_failed'), { status: res.status, body });
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function showConfirm(message, opts){
    opts = opts || {};
    return new Promise((resolve) => {
      const modal = $('confirm-modal');
      $('confirm-modal-title').textContent = opts.title || 'Are you sure?';
      $('confirm-modal-message').textContent = message;
      $('confirm-modal-ok').textContent = opts.okLabel || 'Delete';
      modal.style.display = 'flex';
      const okBtn = $('confirm-modal-ok');
      const cancelBtn = $('confirm-modal-cancel');
      const cleanup = (result) => {
        modal.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
    });
  }

  function logout(){
    token = null;
    currentUser = null;
    localStorage.removeItem('rxscan_token');
    appScreen.style.display = 'none';
    superadminScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
  }

  async function loadNotifications(){
    try{
      const data = await api('/api/notifications');
      const badge = $('notif-badge');
      if (data.unreadCount > 0){
        badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
      $('notif-list').innerHTML = data.notifications.map(n => (
        '<div data-notif-id="'+n.id+'" style="padding:9px 4px;border-bottom:1px solid var(--line);cursor:pointer;'+(n.read?'opacity:0.55;':'')+'">'+
          '<div style="font-size:12.5px;font-weight:'+(n.read?'400':'700')+';">'+escapeHtml(n.title)+'</div>'+
          (n.body ? '<div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px;">'+escapeHtml(n.body)+'</div>' : '')+
          '<div style="font-size:10.5px;color:var(--ink-soft);margin-top:2px;">'+new Date(n.createdAt).toLocaleString()+'</div>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No notifications</div>';
      $('notif-list').querySelectorAll('[data-notif-id]').forEach(el => {
        el.addEventListener('click', async () => {
          try{
            await api('/api/notifications/'+el.dataset.notifId+'/read', {method:'POST'});
            await loadNotifications();
          } catch(e){}
        });
      });
    } catch(e){}
  }

  $('notif-btn').addEventListener('click', () => {
    const panel = $('notif-panel');
    const opening = panel.style.display === 'none';
    panel.style.display = opening ? 'block' : 'none';
    if (opening) loadNotifications();
  });

  $('notif-mark-all-btn').addEventListener('click', async () => {
    try{
      await api('/api/notifications/read-all', {method:'POST'});
      await loadNotifications();
    } catch(e){}
  });

  function populateCompanySwitcher(){
    const sel = $('company-switcher');
    const companies = currentUser.companies || [];
    if (companies.length < 2){
      sel.style.display = 'none';
      sel.innerHTML = '';
      return;
    }
    sel.innerHTML = companies.map(c =>
      '<option value="'+c.organizationId+'"'+(c.organizationName===currentUser.organizationName?' selected':'')+'>'+escapeHtml(c.organizationName)+'</option>'
    ).join('');
    sel.style.display = 'block';
  }

  $('company-switcher').addEventListener('change', async (e) => {
    const organizationId = Number(e.target.value);
    try{
      const data = await api('/api/auth/switch-company', {
        method:'POST',
        body: JSON.stringify({organizationId})
      });
      token = data.token;
      currentUser = { ...data.user, companies: data.companies || [] };
      localStorage.setItem('rxscan_token', token);
      await enterApp();
    } catch(e){
      showToast('Could not switch companies', 'error');
    }
  });

  $('logout-btn').addEventListener('click', logout);
  $('sa-logout-btn').addEventListener('click', logout);

  $('login-btn').addEventListener('click', async () => {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    $('login-error').style.display = 'none';
    try{
      const data = await api('/api/auth/login', {
        method:'POST',
        body: JSON.stringify({email, password})
      });
      token = data.token;
      currentUser = { ...data.user, companies: data.companies || [] };
      localStorage.setItem('rxscan_token', token);
      enterApp();
    } catch(e){
      $('login-error').textContent = 'Incorrect email or password';
      $('login-error').style.display = 'block';
    }
  });

  // ---- register a brand-new pharmacy (organization) ----
  $('show-register-btn').addEventListener('click', () => {
    document.querySelector('.login-card:not(#register-card)').style.display = 'none';
    $('register-card').style.display = 'block';
  });
  $('show-login-btn').addEventListener('click', () => {
    $('register-card').style.display = 'none';
    document.querySelector('.login-card:not(#register-card)').style.display = 'block';
  });

  $('register-btn').addEventListener('click', async () => {
    const organizationName = $('reg-org-name').value.trim();
    const branchName = $('reg-branch-name').value.trim();
    const adminEmail = $('reg-admin-email').value.trim();
    const adminPassword = $('reg-admin-password').value;
    $('register-error').style.display = 'none';
    if (!organizationName || !adminEmail || !adminPassword){
      $('register-error').textContent = 'Please fill in the pharmacy name, email, and password';
      $('register-error').style.display = 'block';
      return;
    }
    $('register-btn').disabled = true;
    try{
      const data = await api('/api/auth/register-organization', {
        method:'POST',
        body: JSON.stringify({organizationName, branchName, adminEmail, adminPassword})
      });
      token = data.token;
      currentUser = { ...data.user, companies: data.companies || [] };
      localStorage.setItem('rxscan_token', token);
      enterApp();
    } catch(e){
      $('register-error').textContent = 'That email is already taken, or something went wrong';
      $('register-error').style.display = 'block';
    } finally {
      $('register-btn').disabled = false;
    }
  });

  let knownItemNames = [];
  async function loadKnownItemNames(){
    try{
      knownItemNames = await api('/api/item-names');
    } catch(e){}
  }

  async function enterApp(){
    loginScreen.style.display = 'none';
    if (currentUser.role === 'super_admin'){
      appScreen.style.display = 'none';
      superadminScreen.style.display = 'flex';
      await loadSuperAdminOverview();
      await loadCompanies();
      await loadSuperAdminActivityLog();
      await loadSuperAdminPayments();
      await loadPendingBranches();
      return;
    }
    appScreen.style.display = 'flex';
    $('branch-tag').textContent = (currentUser.organizationName ? currentUser.organizationName + ' · ' : '') + (currentUser.branchName || 'No branch') + ' · ' + currentUser.email;
    populateCompanySwitcher();
    const isOrgManager = currentUser.role === 'owner' || currentUser.role === 'company_admin';
    const isOrgReader = isOrgManager || currentUser.role === 'viewer';
    $('admin-tab-btn').style.display = isOrgManager ? 'block' : 'none';
    $('reports-tab-btn').style.display = isOrgReader ? 'block' : 'none';
    $('scan-tab-btn').style.display = currentUser.role === 'viewer' ? 'none' : 'block';
    if (currentUser.role === 'viewer'){
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      $('history-tab-btn') && $('history-tab-btn').classList.add('active');
      $('history-view').classList.add('active');
    }
    fillAccountInfo();
    await loadSubscriptionInfo();
    await loadNotifications();
    await loadHistory();
    loadKnownItemNames();
    if (isOrgManager){
      await loadBranches();
      await loadUsers();
      await loadActivityLog();
    }
    if (isOrgReader){
      await loadReports();
    }
  }

  async function loadSuperAdminOverview(){
    try{
      const data = await api('/api/superadmin/overview');
      $('sa-overview').innerHTML =
        statCard('Total companies', data.totalCompanies, 'company') +
        statCard('Active companies', data.activeCompanies, 'active') +
        statCard('Total users', data.totalUsers, 'users') +
        statCard('Est. monthly revenue', '$'+data.estimatedMonthlyRevenue, 'revenue');
      const firstCard = $('sa-overview').querySelector('.stat-card');
      if (firstCard){
        firstCard.style.cursor = 'pointer';
        firstCard.addEventListener('click', () => {
          document.querySelector('#sa-tabs [data-saview="sa-companies-view"]').click();
        });
      }

      renderBarChart('sa-chart-orgs', data.organizationsGrowth||[], {horizontal:false});
      renderBarChart('sa-chart-scans', data.scansGrowth||[], {horizontal:false});

      $('sa-recent-companies').innerHTML = (data.recentCompanies||[]).map(c => (
        '<div class="org-card" data-open-recent-company="'+c.id+'">'+
          '<div class="org-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M14 9h1M14 13h1"/></svg></div>'+
          '<div class="org-card-body"><div class="org-card-name">'+escapeHtml(c.name)+'</div><div class="org-card-meta">'+c.branchCount+' branches · '+c.userCount+' users · '+c.plan+' plan</div></div>'+
          '<span class="status-badge '+(c.status==='active'?'approved':(c.status==='suspended'||c.status==='expired'?'rejected':'pending'))+'">'+c.status+'</span>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No companies yet</div>';
      $('sa-recent-companies').querySelectorAll('[data-open-recent-company]').forEach(row => {
        row.addEventListener('click', () => openCompanyDetail(Number(row.dataset.openRecentCompany)));
      });
    } catch(e){
      $('sa-overview').innerHTML = '<div class="empty-hist">Could not load the overview</div>';
    }
  }

  function activityIconClass(action){
    if (action.indexOf('company') === 0) return 'type-org';
    if (action.indexOf('branch') === 0) return 'type-branch';
    if (action.indexOf('user') === 0 || action === 'login') return 'type-user';
    if (action.indexOf('prescription') === 0) return 'type-rx';
    if (action.indexOf('payment') === 0) return 'type-payment';
    return 'type-org';
  }
  function activityIconSvg(action){
    const icons = {
      org: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M14 9h1M14 13h1"/>',
      branch: '<path d="M4 8a2 2 0 012-2h1.5l1-1.5h7l1 1.5H18a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"/><circle cx="12" cy="13" r="3.5"/>',
      user: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>',
      rx: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
      payment: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    };
    const key = activityIconClass(action).replace('type-','');
    return '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(icons[key]||icons.org)+'</svg>';
  }

  function relativeTime(iso){
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs/60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins+'m ago';
    const hrs = Math.round(mins/60);
    if (hrs < 24) return hrs+'h ago';
    const days = Math.round(hrs/24);
    return days+'d ago';
  }

  let allCompanies = [];

  async function loadCompanies(){
    try{
      allCompanies = await api('/api/superadmin/companies');
      renderCompaniesTable(allCompanies);
    } catch(e){
      $('sa-companies-tbody').innerHTML = '<tr><td colspan="9" style="padding:20px;text-align:center;color:var(--ink-soft);">Could not load companies</td></tr>';
    }
  }

  function planBadge(plan){
    const colors = {free:'pending', basic:'pending', business:'approved', enterprise:'approved'};
    return '<span class="status-badge '+(colors[plan]||'pending')+'" style="text-transform:capitalize;">'+plan+'</span>';
  }

  function renderCompaniesTable(companies){
    const td = 'padding:11px 12px;vertical-align:middle;border-bottom:1px solid var(--line);';
    $('sa-companies-tbody').innerHTML = companies.map(c => {
      const location = [c.city, c.country].filter(Boolean).join(', ') || '—';
      const expired = c.expiryDate && new Date(c.expiryDate).getTime() < Date.now();
      return '<tr>'+
        '<td style="'+td+'"><div style="display:flex;align-items:center;gap:8px;cursor:pointer;" data-open-company="'+c.id+'">'+
          (c.logoData ? '<img src="'+c.logoData+'" style="width:28px;height:28px;border-radius:7px;object-fit:cover;flex-shrink:0;">' : '<div style="width:28px;height:28px;border-radius:7px;background:var(--brand-tint);flex-shrink:0;"></div>')+
          '<b style="font-weight:600;">'+escapeHtml(c.name)+'</b>'+
        '</div></td>'+
        '<td style="'+td+'">'+planBadge(c.plan)+'</td>'+
        '<td style="'+td+'"><span class="status-badge '+(c.status==='active'?'approved':(c.status==='suspended'||c.status==='expired'?'rejected':'pending'))+'">'+c.status+'</span></td>'+
        '<td style="'+td+'color:var(--ink-soft);">'+escapeHtml(location)+'</td>'+
        '<td style="'+td+'">'+c.branchCount+'</td>'+
        '<td style="'+td+'">'+c.userCount+'</td>'+
        '<td style="'+td+'"><b>$'+c.billing.totalCost+'</b><span style="color:var(--ink-soft);">/'+(c.billing.cycle==='yearly'?'yr':'mo')+'</span></td>'+
        '<td style="'+td+(expired?'color:var(--danger);font-weight:600;':'color:var(--ink-soft);')+'">'+(c.expiryDate ? c.expiryDate.slice(0,10) : '—')+(expired?' (expired)':'')+'</td>'+
        '<td style="'+td+'"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'+
          (c.status !== 'active' ? '<button type="button" class="approve-btn" data-activate="'+c.id+'">Activate</button>' : '')+
          (c.status !== 'suspended' ? '<button type="button" class="reject-btn" data-suspend="'+c.id+'">Suspend</button>' : '')+
          '<button type="button" class="del-btn" data-delete="'+c.id+'">Delete</button>'+
          '<select data-plan-select="'+c.id+'" title="Change plan" style="font-size:11.5px;padding:3px 4px;border-radius:6px;border:1px solid var(--line);color:var(--ink-soft);">'+
            ['free','basic','business','enterprise'].map(p => '<option value="'+p+'"'+(p===c.plan?' selected':'')+'>'+p+'</option>').join('')+
          '</select>'+
        '</div></td>'+
      '</tr>';
    }).join('') || '<tr><td colspan="9" style="padding:20px;text-align:center;color:var(--ink-soft);">No companies yet</td></tr>';

    $('sa-companies-tbody').querySelectorAll('[data-activate]').forEach(btn => {
      btn.addEventListener('click', () => setCompanyStatus(btn.dataset.activate, 'active'));
    });
    $('sa-companies-tbody').querySelectorAll('[data-suspend]').forEach(btn => {
      btn.addEventListener('click', () => setCompanyStatus(btn.dataset.suspend, 'suspended'));
    });
    $('sa-companies-tbody').querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteCompany(btn.dataset.delete));
    });
    $('sa-companies-tbody').querySelectorAll('[data-plan-select]').forEach(sel => {
      sel.addEventListener('change', () => setCompanyPlan(sel.dataset.planSelect, sel.value));
    });
    $('sa-companies-tbody').querySelectorAll('[data-open-company]').forEach(el => {
      el.addEventListener('click', () => openCompanyDetail(Number(el.dataset.openCompany)));
    });
  }

  $('sa-company-back-btn').addEventListener('click', () => {
    document.querySelectorAll('#sa-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sa-view').forEach(v => v.classList.remove('active'));
    $('sa-companies-view').classList.add('active');
    document.querySelector('#sa-tabs [data-saview="sa-companies-view"]').classList.add('active');
  });

  async function openCompanyDetail(id){
    document.querySelectorAll('#sa-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sa-view').forEach(v => v.classList.remove('active'));
    $('sa-company-detail-view').classList.add('active');
    $('sa-branch-team-section').style.display = 'none';
    $('sa-company-detail-name').textContent = 'Loading...';
    $('sa-company-branch-list').innerHTML = '';
    try{
      const [company, branches] = await Promise.all([
        api('/api/superadmin/companies/'+id),
        api('/api/superadmin/companies/'+id+'/branches'),
      ]);
      $('sa-company-detail-name').textContent = company.name;
      $('sa-company-detail-sub').textContent = company.status+' · '+company.plan+' plan · '+company.branchCount+' branches · '+company.userCount+' users';
      $('sa-company-branch-list').innerHTML = branches.map(b => (
        '<div class="branch-card">'+
          '<div class="branch-card-head">'+
            '<div class="name"><span class="branch-icon">'+BRANCH_ICON_SVG+'</span>'+escapeHtml(b.name)+'</div>'+
            (b.approved === false ? '<span class="status-badge pending">Pending approval</span>' : '<span class="status-badge approved">Active</span>')+
          '</div>'+
          '<div class="branch-stat-row">'+
            '<div><div class="bs-label">Users</div><div class="bs-value">'+b.userCount+'</div></div>'+
            '<div><div class="bs-label">Prescriptions</div><div class="bs-value">'+b.prescriptionCount+'</div></div>'+
            '<div><div class="bs-label">Scans today</div><div class="bs-value">'+b.scansToday+'</div></div>'+
            '<div><div class="bs-label">Manager</div><div class="bs-value" style="font-size:12.5px;">'+escapeHtml(b.managerEmail||'—')+'</div></div>'+
          '</div>'+
          '<button class="btn-ghost" type="button" data-view-team="'+b.id+'" data-branch-name="'+escapeAttr(b.name)+'">View team</button>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No branches</div>';
      $('sa-company-branch-list').querySelectorAll('[data-view-team]').forEach(btn => {
        btn.addEventListener('click', () => showBranchTeam(Number(btn.dataset.viewTeam), btn.dataset.branchName, company.users));
      });
    } catch(e){
      $('sa-company-detail-name').textContent = 'Could not load this company';
    }
  }

  function showBranchTeam(branchId, branchName, allUsers){
    const section = $('sa-branch-team-section');
    section.style.display = 'flex';
    $('sa-branch-team-title').textContent = 'Team — ' + branchName;
    const team = (allUsers||[]).filter(u => u.branchId === branchId);
    $('sa-branch-team-list').innerHTML = team.map(u => (
      '<div class="admin-row"><span>'+escapeHtml(u.email)+'<div class="meta">'+roleLabel(u.role)+'</div></span></div>'
    )).join('') || '<div class="empty-hist">No one assigned to this branch yet</div>';
    section.scrollIntoView({behavior:'smooth', block:'start'});
  }

  $('sa-company-search').addEventListener('input', () => {
    const term = $('sa-company-search').value.trim().toLowerCase();
    if (!term){ renderCompaniesTable(allCompanies); return; }
    renderCompaniesTable(allCompanies.filter(c =>
      [c.name, c.city, c.country, c.status, c.plan].some(v => (v||'').toLowerCase().includes(term))
    ));
  });

  async function setCompanyPlan(id, plan){
    try{
      await api('/api/superadmin/companies/'+id+'/plan', {method:'POST', body: JSON.stringify({plan})});
      await loadCompanies();
    } catch(e){}
  }

  async function setCompanyBillingCycle(id, billingCycle){
    try{
      await api('/api/superadmin/companies/'+id+'/billing-cycle', {method:'POST', body: JSON.stringify({billingCycle})});
      await loadCompanies();
    } catch(e){}
  }

  async function setCompanyExpiry(id, expiryDate){
    try{
      await api('/api/superadmin/companies/'+id, {method:'PATCH', body: JSON.stringify({expiryDate})});
      await loadCompanies();
    } catch(e){}
  }

  $('sa-create-admin-btn').addEventListener('click', async () => {
    const email = $('sa-new-admin-email2').value.trim();
    const password = $('sa-new-admin-password2').value;
    $('sa-create-admin-msg').innerHTML = '';
    if (!email || !password){
      $('sa-create-admin-msg').innerHTML = '<div class="admin-row" style="color:#8C2C20;">Email and password are required</div>';
      return;
    }
    $('sa-create-admin-btn').disabled = true;
    try{
      await api('/api/superadmin/create-admin', {method:'POST', body: JSON.stringify({email, password})});
      $('sa-new-admin-email2').value = '';
      $('sa-new-admin-password2').value = '';
      $('sa-create-admin-msg').innerHTML = '<div class="admin-row" style="color:#016E51;">Super admin created</div>';
    } catch(e){
      $('sa-create-admin-msg').innerHTML = '<div class="admin-row" style="color:#8C2C20;">That email is already taken, or something went wrong</div>';
    } finally {
      $('sa-create-admin-btn').disabled = false;
    }
  });

  async function loadSuperAdminPayments(){
    try{
      const payments = await api('/api/superadmin/payments?status=pending');
      $('sa-payments').innerHTML = payments.map(p => (
        '<div class="admin-row" style="flex-direction:column;align-items:stretch;gap:6px;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+escapeHtml(p.companyName||'—')+'</b><span class="meta">$'+p.amount+' '+p.currency+'</span></div>'+
          '<span class="meta">'+escapeHtml(p.requestedBy||'')+' · '+new Date(p.createdAt).toLocaleString()+(p.reference?' · '+escapeHtml(p.reference):'')+'</span>'+
          '<div style="display:flex;gap:8px;">'+
            '<button type="button" class="approve-btn" data-approve-payment="'+p.id+'">Approve</button>'+
            '<button type="button" class="reject-btn" data-reject-payment="'+p.id+'">Reject</button>'+
          '</div>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No pending payment requests</div>';
      $('sa-payments').querySelectorAll('[data-approve-payment]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try{ await api('/api/superadmin/payments/'+btn.dataset.approvePayment+'/approve', {method:'POST'}); await loadSuperAdminPayments(); await loadCompanies(); } catch(e){}
        });
      });
      $('sa-payments').querySelectorAll('[data-reject-payment]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try{ await api('/api/superadmin/payments/'+btn.dataset.rejectPayment+'/reject', {method:'POST'}); await loadSuperAdminPayments(); } catch(e){}
        });
      });
    } catch(e){
      $('sa-payments').innerHTML = '<div class="empty-hist">Could not load payment requests</div>';
    }
  }

  async function loadPendingBranches(){
    try{
      const branches = await api('/api/superadmin/branches/pending');
      $('sa-pending-branches').innerHTML = branches.map(b => (
        '<div class="admin-row" style="flex-direction:column;align-items:stretch;gap:6px;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+escapeHtml(b.name)+'</b><span class="meta">'+escapeHtml(b.companyName||'—')+'</span></div>'+
          '<span class="meta">Requested '+new Date(b.createdAt).toLocaleString()+'</span>'+
          '<div style="display:flex;gap:8px;">'+
            '<button type="button" class="approve-btn" data-approve-branch="'+b.id+'">Approve</button>'+
            '<button type="button" class="reject-btn" data-reject-branch="'+b.id+'">Reject</button>'+
          '</div>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No pending branch requests</div>';
      $('sa-pending-branches').querySelectorAll('[data-approve-branch]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try{
            await api('/api/superadmin/branches/'+btn.dataset.approveBranch+'/approve', {method:'POST'});
            showToast('Branch approved', 'success');
            await loadPendingBranches();
          } catch(e){ showToast('Could not approve the branch', 'error'); }
        });
      });
      $('sa-pending-branches').querySelectorAll('[data-reject-branch]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try{
            await api('/api/superadmin/branches/'+btn.dataset.rejectBranch+'/reject', {method:'POST'});
            showToast('Branch rejected', 'info');
            await loadPendingBranches();
          } catch(e){ showToast('Could not reject the branch', 'error'); }
        });
      });
    } catch(e){
      $('sa-pending-branches').innerHTML = '<div class="empty-hist">Could not load pending branches</div>';
    }
  }

  async function loadSuperAdminActivityLog(){
    try{
      const logs = await api('/api/superadmin/activity-logs');
      $('sa-activity-log').innerHTML = logs.map(l => {
        const when = new Date(l.createdAt).toLocaleString();
        return '<div class="admin-row" style="flex-direction:column;align-items:stretch;gap:2px;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+escapeHtml(activityActionLabel(l.action))+'</b><span class="meta">'+escapeHtml(when)+'</span></div>'+
          '<span class="meta">'+escapeHtml(l.userEmail||'—')+(l.companyName ? ' · '+escapeHtml(l.companyName) : '')+(l.details ? ' · '+escapeHtml(l.details) : '')+'</span>'+
        '</div>';
      }).join('') || '<div class="empty-hist">No activity yet</div>';
    } catch(e){
      $('sa-activity-log').innerHTML = '<div class="empty-hist">Could not load the activity log</div>';
    }
  }

  async function setCompanyStatus(id, status){
    try{
      await api('/api/superadmin/companies/'+id+'/status', {method:'POST', body: JSON.stringify({status})});
      await loadCompanies();
      await loadSuperAdminOverview();
    } catch(e){}
  }

  async function deleteCompany(id){
    const ok = await showConfirm('Delete this company and everything in it? This cannot be undone.', {title: 'Delete company?'});
    if (!ok) return;
    try{
      await api('/api/superadmin/companies/'+id, {method:'DELETE'});
      await loadCompanies();
      await loadSuperAdminOverview();
      showToast('Company deleted', 'success');
    } catch(e){
      showToast('Could not delete the company', 'error');
    }
  }

  $('sa-create-btn').addEventListener('click', async () => {
    const name = $('sa-new-name').value.trim();
    const branchName = $('sa-new-branch').value.trim();
    const adminEmail = $('sa-new-admin-email').value.trim();
    const adminPassword = $('sa-new-admin-password').value;
    const phone = $('sa-new-phone').value.trim();
    const email = $('sa-new-email').value.trim();
    const city = $('sa-new-city').value.trim();
    const country = $('sa-new-country').value.trim();
    const plan = $('sa-new-plan').value;
    const billingCycle = $('sa-new-billing').value;
    $('sa-create-msg').innerHTML = '';
    if (!name){
      $('sa-create-msg').innerHTML = '<div class="admin-row" style="color:#8C2C20;">Company name is required</div>';
      return;
    }
    $('sa-create-btn').disabled = true;
    try{
      await api('/api/superadmin/companies', {
        method:'POST',
        body: JSON.stringify({name, branchName, adminEmail, adminPassword, phone, email, city, country, plan, billingCycle})
      });
      $('sa-new-name').value = '';
      $('sa-new-branch').value = '';
      $('sa-new-admin-email').value = '';
      $('sa-new-admin-password').value = '';
      $('sa-new-phone').value = '';
      $('sa-new-email').value = '';
      $('sa-new-city').value = '';
      $('sa-new-country').value = '';
      $('sa-new-plan').value = 'free';
      $('sa-new-billing').value = 'monthly';
      $('sa-create-msg').innerHTML = '<div class="admin-row" style="color:#016E51;">Company created</div>';
      await loadCompanies();
      await loadSuperAdminOverview();
    } catch(e){
      $('sa-create-msg').innerHTML = '<div class="admin-row" style="color:#8C2C20;">That email is already taken, or something went wrong</div>';
    } finally {
      $('sa-create-btn').disabled = false;
    }
  });

  function fillAccountInfo(){
    $('account-info').innerHTML =
      '<div class="admin-row"><span>Pharmacy</span><span class="meta">'+escapeHtml(currentUser.organizationName||'—')+'</span></div>'+
      '<div class="admin-row"><span>Email</span><span class="meta">'+escapeHtml(currentUser.email)+'</span></div>'+
      '<div class="admin-row"><span>Role</span><span class="meta">'+roleLabel(currentUser.role)+'</span></div>'+
      '<div class="admin-row"><span>Branch</span><span class="meta">'+escapeHtml(currentUser.branchName||'No branch')+'</span></div>';
    updateAvatarDisplays();
  }

  async function loadSubscriptionInfo(){
    try{
      const data = await api('/api/company/subscription');
      const u = data.usage, l = data.limits, b = data.billing;
      const fmt = (used, max) => max === null ? used + ' (unlimited)' : used + ' / ' + max;
      const isOrgManager = currentUser.role === 'owner' || currentUser.role === 'company_admin';
      if (isOrgManager){
        $('company-logo-section').style.display = 'block';
        $('payment-section').style.display = 'block';
        await loadPaymentHistory();
        if (data.logoData){
          $('company-logo-preview').innerHTML = '<img src="'+data.logoData+'" style="width:100%;height:100%;object-fit:cover;">';
        }
      }
      let expiryRow = '';
      if (data.expiryDate){
        const expiryDate = new Date(data.expiryDate);
        const expired = expiryDate.getTime() < Date.now();
        expiryRow = '<div class="admin-row"><span>Expires</span><span class="meta"'+(expired?' style="color:var(--danger-deep);font-weight:600;"':'')+'>'+expiryDate.toLocaleDateString()+(expired?' (expired)':'')+'</span></div>';
      }
      $('subscription-info').innerHTML =
        '<div class="admin-row"><span>Plan</span><span class="meta">'+escapeHtml(l.label)+'</span></div>'+
        '<div class="admin-row"><span>Status</span><span class="meta">'+escapeHtml(data.status)+'</span></div>'+
        expiryRow+
        '<div class="admin-row"><span>Branches</span><span class="meta">'+fmt(u.branches, l.maxBranches)+'</span></div>'+
        '<div class="admin-row"><span>Users</span><span class="meta">'+fmt(u.users, l.maxUsers)+'</span></div>'+
        '<div class="admin-row"><span>Scans this month</span><span class="meta">'+fmt(u.scansThisMonth, l.maxScansPerMonth)+'</span></div>'+
        '<div class="admin-row"><span>Billing</span><span class="meta">$'+b.pricePerBranch+' / branch / '+(b.cycle==='yearly'?'year':'month')+'</span></div>'+
        '<div class="admin-row"><span>Total ('+b.branchCount+' branch'+(b.branchCount===1?'':'es')+')</span><span class="meta"><b>$'+b.totalCost+' / '+(b.cycle==='yearly'?'year':'month')+'</b></span></div>';
      $('subscription-section').style.display = 'block';
    } catch(e){
      $('subscription-section').style.display = 'none';
    }
  }

  $('company-logo-pick-btn').addEventListener('click', () => $('company-logo-input').click());
  $('company-logo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try{
      const b64 = await fileToBase64(file);
      const data = await api('/api/company/logo', {method:'POST', body: JSON.stringify({imageBase64: b64, mediaType: file.type || 'image/png'})});
      $('company-logo-preview').innerHTML = '<img src="'+data.logoData+'" style="width:100%;height:100%;object-fit:cover;">';
    } catch(err){
      showToast('Could not load the logo', 'error');
    }
  });

  async function loadPaymentHistory(){
    try{
      const payments = await api('/api/company/payments');
      $('payment-history').innerHTML = payments.map(p => (
        '<div class="admin-row" style="flex-direction:column;align-items:stretch;gap:2px;">'+
          '<div style="display:flex;justify-content:space-between;"><b>$'+p.amount+'</b><span class="status-badge '+(p.status==='approved'?'approved':(p.status==='rejected'?'rejected':'pending'))+'">'+p.status+'</span></div>'+
          '<span class="meta">'+new Date(p.createdAt).toLocaleString()+(p.reference?' · '+escapeHtml(p.reference):'')+'</span>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No payment requests yet</div>';
    } catch(e){
      $('payment-history').innerHTML = '';
    }
  }

  $('request-payment-btn').addEventListener('click', async () => {
    const reference = $('payment-reference').value.trim();
    $('payment-request-msg').innerHTML = '';
    $('request-payment-btn').disabled = true;
    try{
      await api('/api/company/payments/request', {method:'POST', body: JSON.stringify({reference})});
      $('payment-reference').value = '';
      $('payment-request-msg').innerHTML = '<div class="admin-row" style="color:#016E51;">Request sent — the platform admin will review it</div>';
      await loadPaymentHistory();
    } catch(e){
      $('payment-request-msg').innerHTML = '<div class="admin-row" style="color:#8C2C20;">Could not send the request</div>';
    } finally {
      $('request-payment-btn').disabled = false;
    }
  });

  function updateAvatarDisplays(){
    const src = currentUser && currentUser.avatarData;
    const preview = $('avatar-preview');
    if (src){
      preview.innerHTML = '<img src="'+src+'" style="width:100%;height:100%;object-fit:cover;">';
    } else {
      preview.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke="var(--ink-soft)" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
    }
    const brandMark = document.querySelector('.brand-mark');
    if (brandMark){
      brandMark.innerHTML = '<img src="'+(src || LOGO_DATA_URI)+'" style="width:100%;height:100%;object-fit:cover;">';
    }
  }

  $('avatar-pick-btn').addEventListener('click', () => $('avatar-input').click());
  $('avatar-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try{
      const b64 = await fileToBase64(file);
      const data = await api('/api/auth/avatar', {method:'POST', body: JSON.stringify({imageBase64: b64, mediaType: file.type || 'image/jpeg'})});
      currentUser.avatarData = data.avatarData;
      updateAvatarDisplays();
    } catch(err){
      showToast('Could not load the photo', 'error');
    }
  });

  $('change-pass-btn').addEventListener('click', async () => {
    const currentPassword = $('cur-password').value;
    const newPassword = $('new-password').value;
    const msg = $('change-pass-msg');
    msg.innerHTML = '';
    if (!currentPassword || !newPassword){
      msg.innerHTML = '<div class="notice">Fill in both fields</div>';
      return;
    }
    try{
      await api('/api/auth/change-password', {method:'POST', body: JSON.stringify({currentPassword, newPassword})});
      $('cur-password').value=''; $('new-password').value='';
      msg.innerHTML = '<div class="admin-row" style="color:#016E51;">Password changed</div>';
    } catch(e){
      msg.innerHTML = '<div class="notice">Current password is wrong, or the new one is too short</div>';
    }
  });

  // Resume session if a token is already stored
  (async function tryResume(){
    if (!token) return;
    try{
      currentUser = await api('/api/auth/me');
      await enterApp();
    } catch(e){
      logout();
    }
  })();

  // ---- tabs ----
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.dataset.view) return; // handled separately (e.g. sa-tabs)
      document.querySelectorAll('.tab-btn').forEach(b => { if (b.dataset.view) b.classList.remove('active'); });
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      $(btn.dataset.view).classList.add('active');
    });
  });

  // ---- super admin sidebar tabs ----
  document.querySelectorAll('#sa-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sa-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sa-view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      $(btn.dataset.saview).classList.add('active');
    });
  });

  $('sa-show-create-btn').addEventListener('click', () => {
    const sec = $('sa-create-section');
    sec.style.display = sec.style.display === 'none' ? 'flex' : 'none';
    if (sec.style.display !== 'none') sec.scrollIntoView({behavior:'smooth', block:'start'});
  });

  // ---- scan flow ----
  const dropzone = $('dropzone'), previewArea = $('preview-area'), previewGrid = $('preview-grid');
  const cameraInput = $('camera-input'), galleryInput = $('gallery-input');
  const statusArea = $('status-area'), formSection = $('form-section'), medList = $('med-list');
  const fDoctor = $('f-doctor'), fPhone = $('f-phone');

  let currentFiles = [];

  $('camera-btn').addEventListener('click', () => cameraInput.click());
  $('gallery-btn').addEventListener('click', () => galleryInput.click());
  $('add-more-btn').addEventListener('click', () => galleryInput.click());
  cameraInput.addEventListener('change', e => addFiles(e.target.files));
  galleryInput.addEventListener('change', e => addFiles(e.target.files));

  function addFiles(fileList){
    if (!fileList || !fileList.length) return;
    currentFiles.push(...Array.from(fileList));
    renderPreviewGrid();
    dropzone.style.display = 'none';
    previewArea.style.display = 'flex';
    statusArea.innerHTML = '';
    cameraInput.value = ''; galleryInput.value = '';
  }

  function renderPreviewGrid(){
    previewGrid.innerHTML = '';
    currentFiles.forEach((file, i) => {
      const div = document.createElement('div');
      div.className = 'preview-thumb';
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        currentFiles.splice(i, 1);
        if (currentFiles.length === 0){
          previewArea.style.display = 'none';
          dropzone.style.display = 'flex';
        } else {
          renderPreviewGrid();
        }
      });
      div.appendChild(img);
      div.appendChild(removeBtn);
      previewGrid.appendChild(div);
    });
  }

  $('retake-btn').addEventListener('click', () => {
    currentFiles = [];
    previewArea.style.display = 'none';
    dropzone.style.display = 'flex';
    statusArea.innerHTML = '';
    cameraInput.value = ''; galleryInput.value = '';
  });

  function setStatus(html){ statusArea.innerHTML = html; }
  function showThinking(){ setStatus('<div class="status-line"><span class="spinner"></span><span>Analyzing, please wait...</span></div>'); }
  function showNotice(text){ setStatus('<div class="notice">'+text+'</div>'); }

  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  $('read-btn').addEventListener('click', async () => {
    if (!currentFiles.length) return;
    $('read-btn').disabled = true;
    showThinking();
    try{
      const primary = currentFiles[0];
      const b64 = await fileToBase64(primary);
      const data = await api('/api/scan', {
        method:'POST',
        body: JSON.stringify({ imageBase64: b64, mediaType: primary.type || 'image/jpeg' })
      });
      setStatus('');
      fillForm(data);
    } catch(e){
      showNotice('Could not read the photo. Please try again or enter it manually.');
      fillForm({});
    } finally {
      $('read-btn').disabled = false;
    }
  });

  let itemImageDebounce = null;

  const MED_PLACEHOLDER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke="var(--ink-soft)" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 117-7l7 7a4.95 4.95 0 11-7 7z"/><path d="M8.5 8.5l7 7"/></svg>';
  const BRANCH_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M14 9h1M14 13h1"/></svg>';

  function addMedRow(value){
    const card = document.createElement('div');
    card.className = 'med-card';
    card.innerHTML =
      '<div class="med-card-header">'+
        '<div class="med-card-icon">'+MED_PLACEHOLDER_ICON+'</div>'+
        '<div class="med-card-title">'+
          '<input class="med-name-input" type="text" placeholder="Item name" value="'+escapeAttr(value||'')+'">'+
          '<div class="med-card-type"></div>'+
          '<div class="med-photo-caption" style="font-size:11px;color:var(--ink-soft);"></div>'+
        '</div>'+
        '<button type="button" class="icon-btn med-remove-btn"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:8px;">'+
        '<button type="button" class="btn-ghost med-verify-btn" style="padding:6px 12px;font-size:12px;">📷 Verify item photo</button>'+
        '<input type="file" accept="image/*" class="med-verify-input" style="display:none;">'+
      '</div>'+
      '<div class="med-verify-result"></div>'+
      '<div class="med-info-area"></div>';

    card.querySelector('.med-remove-btn').addEventListener('click', () => {
      card.remove();
      updateMedCount();
    });
    const input = card.querySelector('.med-name-input');
    const cardIcon = card.querySelector('.med-card-icon');
    const photoCaption = card.querySelector('.med-photo-caption');
    const infoArea = card.querySelector('.med-info-area');
    const verifyBtn = card.querySelector('.med-verify-btn');
    const verifyInput = card.querySelector('.med-verify-input');
    const verifyResult = card.querySelector('.med-verify-result');

    verifyBtn.addEventListener('click', () => verifyInput.click());
    verifyInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const name = input.value.trim();
      if (!name){
        verifyResult.innerHTML = '<div class="med-info-unavailable">Type the item name first, then verify its photo.</div>';
        verifyInput.value = '';
        return;
      }
      verifyResult.innerHTML = '<div class="med-info-loading"><span class="spinner" style="width:12px;height:12px;"></span>Checking the photo against "'+escapeHtml(name)+'"...</div>';
      try{
        const b64 = await fileToBase64(file);
        const result = await api('/api/medicine-verify-photo', {
          method:'POST',
          body: JSON.stringify({ name, imageBase64: b64, mediaType: file.type || 'image/jpeg' }),
        });
        // Save this photo as the item's remembered photo — organization-wide,
        // so it shows automatically for this item name at every branch from now on.
        try{
          await api('/api/item-image', {
            method:'POST',
            body: JSON.stringify({ name, imageBase64: b64, mediaType: file.type || 'image/jpeg' }),
          });
        } catch(saveErr){}
        const previewUrl = URL.createObjectURL(file);
        cardIcon.innerHTML = '<img src="'+previewUrl+'">';
        photoCaption.textContent = "Saved as this item's photo";
        const previewImg = '<img src="'+previewUrl+'" style="width:34px;height:34px;object-fit:cover;border-radius:6px;border:1px solid var(--line);flex-shrink:0;">';
        if (!result.checked){
          verifyResult.innerHTML = '<div style="display:flex;gap:8px;align-items:center;">'+previewImg+'<span class="med-info-unavailable" style="padding:0;">Could not check the photo right now.</span></div>';
        } else if (result.matches){
          verifyResult.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-start;">'+previewImg+
            '<div><span class="status-badge approved">✓ Looks like a match</span>'+
            (result.note ? '<div class="meta" style="margin-top:3px;">'+escapeHtml(result.note)+'</div>' : '')+
            '</div></div>';
        } else {
          verifyResult.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-start;">'+previewImg+
            '<div><span class="status-badge rejected">⚠ May not match — please double-check</span>'+
            (result.detectedName ? '<div class="meta" style="margin-top:3px;">Photo appears to show: '+escapeHtml(result.detectedName)+'</div>' : '')+
            (result.note ? '<div class="meta">'+escapeHtml(result.note)+'</div>' : '')+
            '</div></div>';
        }
      } catch(e){
        verifyResult.innerHTML = '<div class="med-info-unavailable">Could not check the photo right now.</div>';
      } finally {
        verifyInput.value = '';
      }
    });

    const checkItem = () => {
      const name = input.value.trim();
      cardIcon.innerHTML = MED_PLACEHOLDER_ICON;
      photoCaption.textContent = '';
      infoArea.innerHTML = '';
      card.querySelector('.med-card-type').textContent = '';
      input.style.borderBottom = '';
      const dupWarning = card.querySelector('.med-dup-warning');
      if (dupWarning) dupWarning.remove();
      if (!name) return;
      const isDuplicate = Array.from(medList.querySelectorAll('.med-name-input')).some(el =>
        el !== input && el.value.trim().toLowerCase() === name.toLowerCase()
      );
      if (isDuplicate){
        const warn = document.createElement('div');
        warn.className = 'med-dup-warning';
        warn.style.cssText = 'font-size:11px;color:var(--danger-deep);margin-top:-6px;';
        warn.textContent = 'This item is already in the list';
        card.querySelector('.med-card-title').appendChild(warn);
        input.style.borderBottom = '1.5px solid var(--danger)';
      }
      clearTimeout(itemImageDebounce);
      itemImageDebounce = setTimeout(async () => {
        // remembered photo for this item name
        try{
          const data = await api('/api/item-image?name=' + encodeURIComponent(name));
          if (data.imageData){
            cardIcon.innerHTML = '<img src="'+data.imageData+'">';
            photoCaption.textContent = data.createdByOrgName ? 'Photo added by '+data.createdByOrgName : 'Photo on file';
          }
        } catch(e){}
        // AI reference info
        infoArea.innerHTML = '<div class="med-info-loading"><span class="spinner" style="width:12px;height:12px;"></span>Looking up medicine info...</div>';
        try{
          const info = await api('/api/medicine-info', {method:'POST', body: JSON.stringify({name})});
          if (!info.identified){
            infoArea.innerHTML = '<div class="med-info-unavailable">Medicine information unavailable — please verify the medicine name or review manually.</div>';
            return;
          }
          card.querySelector('.med-card-type').textContent = [info.strength, info.type, info.manufacturer ? 'by '+info.manufacturer : ''].filter(Boolean).join(' · ');
          const importantList = (info.important||[]).map(x=>'<li>'+escapeHtml(x)+'</li>').join('') || '<li>—</li>';
          const sideEffectsList = (info.sideEffects||[]).map(x=>'<li>'+escapeHtml(x)+'</li>').join('') || '<li>—</li>';
          infoArea.innerHTML =
            '<div class="med-info-grid">'+
              '<div class="med-info-item used-for"><div class="mi-head"><div class="mi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 117-7l7 7a4.95 4.95 0 11-7 7z"/><path d="M8.5 8.5l7 7"/></svg></div><span class="mi-label">Used for</span></div><div class="mi-value">'+escapeHtml(info.usedFor||'—')+'</div></div>'+
              '<div class="med-info-item active-ingredient"><div class="mi-head"><div class="mi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg></div><span class="mi-label">Active ingredient</span></div><div class="mi-value">'+escapeHtml(info.activeIngredient||'—')+'</div></div>'+
              '<div class="med-info-item important"><div class="mi-head"><div class="mi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg></div><span class="mi-label">Important</span></div><ul class="mi-list">'+importantList+'</ul></div>'+
              '<div class="med-info-item side-effects"><div class="mi-head"><div class="mi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg></div><span class="mi-label">Common side effects</span></div><ul class="mi-list">'+sideEffectsList+'</ul></div>'+
            '</div>';
        } catch(e){
          infoArea.innerHTML = '<div class="med-info-unavailable">Medicine information unavailable — please verify the medicine name or review manually.</div>';
        }
      }, 600);
    };
    input.addEventListener('input', (e) => {
      if (e.inputType && e.inputType.indexOf('insert') === 0){
        const typed = input.value;
        if (typed){
          const match = knownItemNames.find(n =>
            n.toLowerCase().startsWith(typed.toLowerCase()) && n.length > typed.length
          );
          if (match){
            input.value = typed + match.slice(typed.length);
            input.setSelectionRange(typed.length, match.length);
          }
        }
      }
      checkItem();
    });
    medList.appendChild(card);
    updateMedCount();
    if (value) checkItem();
  }

  function updateMedCount(){
    const countEl = $('med-count');
    if (countEl) countEl.textContent = medList.querySelectorAll('.med-card').length;
  }
  function escapeAttr(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
  function escapeHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function roleLabel(role){
    if (role==='owner') return 'Owner';
    if (role==='company_admin') return 'Company admin';
    if (role==='branch_manager') return 'Branch manager';
    if (role==='viewer') return 'Viewer';
    return 'Employee';
  }

  $('add-med-btn').addEventListener('click', () => addMedRow(''));

  function fillForm(data){
    fDoctor.value = (data && data.doctorName) || '';
    fPhone.value = (data && data.phone) || '';
    $('f-category').value = 'Medicine';
    $('f-source').value = 'Private';
    medList.innerHTML = '';
    const meds = (data && Array.isArray(data.medicines)) ? data.medicines.filter(Boolean) : [];
    if (meds.length === 0) addMedRow(''); else meds.forEach(m => addMedRow(m));
    formSection.style.display = 'flex';
    formSection.scrollIntoView({behavior:'smooth', block:'start'});
  }

  $('save-btn').addEventListener('click', async () => {
    const doctorName = fDoctor.value.trim();
    const phone = fPhone.value.trim();
    const category = $('f-category').value;
    const source = $('f-source').value;
    const medicines = Array.from(medList.querySelectorAll('.med-name-input')).map(i => i.value.trim()).filter(Boolean);
    if (!doctorName && !phone && medicines.length === 0){
      showNotice('Please fill in at least one field before saving.');
      return;
    }
    const seen = new Set();
    const duplicates = new Set();
    medicines.forEach(m => {
      const key = m.toLowerCase();
      if (seen.has(key)) duplicates.add(m);
      seen.add(key);
    });
    if (duplicates.size){
      showNotice('This item is already in the list: '+Array.from(duplicates).join(', ')+'. Please remove the duplicate before saving.');
      return;
    }
    $('save-btn').disabled = true;
    try{
      const body = {doctorName, phone, medicines, category, source};
      if (currentFiles.length){
        body.images = await Promise.all(currentFiles.map(async f => ({
          imageBase64: await fileToBase64(f),
          mediaType: f.type || 'image/jpeg',
        })));
      }
      await api('/api/prescriptions', { method:'POST', body: JSON.stringify(body) });
      showToast('Order saved successfully', 'success');
      formSection.style.display = 'none';
      previewArea.style.display = 'none';
      dropzone.style.display = 'flex';
      currentFiles = [];
      cameraInput.value=''; galleryInput.value='';
      statusArea.innerHTML='';
      await loadHistory();
      loadKnownItemNames();
    } catch(e){
      if (e.body && e.body.error === 'plan_limit_reached'){
        showNotice('Your pharmacy has reached its monthly scan limit ('+e.body.max+'). Ask the platform admin to upgrade your plan.');
      } else if (e.body && e.body.error === 'branch_pending_approval'){
        showNotice('Your branch is still pending approval from the platform admin. Scanning will be enabled once it is approved.');
      } else {
        showNotice('Could not be saved. Please try again.');
      }
    } finally {
      $('save-btn').disabled = false;
    }
  });

  function showToast(message, kind){
    const t = $('toast');
    t.textContent = message || 'Saved';
    t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---- history ----
  function statusLabel(s){
    if (s==='approved') return 'Approved';
    if (s==='rejected') return 'Rejected';
    return 'Pending';
  }

  let allHistoryRows = [];

  function renderHistoryList(rows){
    const list = $('history-list');
    const canReview = currentUser && ['owner','company_admin','branch_manager'].includes(currentUser.role);
    if (!rows.length){ list.innerHTML = '<div class="empty-hist">No results found</div>'; return; }
    list.innerHTML = '';
    rows.forEach(r => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const dateStr = new Date(r.createdAt).toLocaleDateString('ckb', {year:'numeric', month:'short', day:'numeric'});
      const status = r.status || 'pending';
      const extraMeta = [r.branchName, r.employeeEmail].filter(Boolean).join(' · ');
      item.innerHTML =
        '<div class="history-head"><div class="hh-main">'+
          '<div class="doc">'+escapeHtml(r.doctorName||'No doctor name')+' <span style="font-weight:400;color:var(--ink-soft);">· '+escapeHtml(r.category||'Medicine')+' · '+escapeHtml(r.source||'Private')+'</span></div>'+
          '<div class="meta">'+escapeHtml(dateStr)+' · '+r.medicines.length+' Medicine'+(extraMeta ? ' · '+escapeHtml(extraMeta) : '')+'</div>'+
        '</div>'+
        '<span class="status-badge '+status+'">'+statusLabel(status)+'</span>'+
        '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></div>'+
        '<div class="history-body">'+
          (r.medicines.length ? '<ul>'+r.medicines.map(m=>'<li>'+escapeHtml(m)+'</li>').join('')+'</ul>' : '<p style="font-size:13px;color:var(--ink-soft);margin:10px 0 0;">No items recorded</p>')+
          (r.phone ? '<div style="font-size:13px;color:var(--ink-soft);margin-top:8px;">Number: '+escapeHtml(r.phone)+'</div>' : '')+
          (r.imageCount ? '<button class="add-med" type="button" data-view-image="'+r.id+'" style="margin-top:8px;"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 012-2h1.5l1-1.5h7l1 1.5H18a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"/><circle cx="12" cy="13" r="3.5"/></svg>View photo ('+r.imageCount+')</button><div id="img-'+r.id+'" style="display:none;margin-top:8px;grid-template-columns:repeat(3,1fr);gap:8px;"></div>' : '')+
          '<div class="history-actions" style="justify-content:space-between;">'+
            (canReview && status === 'pending' ?
              '<div><button class="approve-btn" type="button" data-approve="'+r.id+'"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>Approve</button>'+
              '<button class="reject-btn" type="button" data-reject="'+r.id+'"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>Reject</button></div>'
              : '<span></span>')+
            '<button class="del-btn" type="button"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>Delete</button>'+
          '</div>'+
        '</div>';
      item.querySelector('.history-head').addEventListener('click', () => item.classList.toggle('open'));
      item.querySelector('.del-btn').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try{ await api('/api/prescriptions/'+r.id, {method:'DELETE'}); await loadHistory(); } catch(e){}
      });
      const approveBtn = item.querySelector('[data-approve]');
      if (approveBtn) approveBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try{ await api('/api/prescriptions/'+r.id+'/approve', {method:'POST'}); await loadHistory(); } catch(e){}
      });
      const rejectBtn = item.querySelector('[data-reject]');
      if (rejectBtn) rejectBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try{ await api('/api/prescriptions/'+r.id+'/reject', {method:'POST'}); await loadHistory(); } catch(e){}
      });
      const viewImgBtn = item.querySelector('[data-view-image]');
      if (viewImgBtn) viewImgBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const holder = document.getElementById('img-'+r.id);
        if (holder.style.display !== 'none'){ holder.style.display = 'none'; return; }
        holder.style.display = 'grid';
        if (!holder.dataset.loaded){
          try{
            const data = await api('/api/prescriptions/'+r.id+'/images');
            const imgs = data.images || [];
            holder.innerHTML = imgs.length
              ? imgs.map(img => '<img src="'+img.imageData+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid var(--line);">').join('')
              : '<div class="empty-hist">No photo</div>';
            holder.dataset.loaded = '1';
          } catch(e){
            holder.innerHTML = '<div class="empty-hist">Could not load the photo</div>';
          }
        }
      });
      list.appendChild(item);
    });
  }

  function filterHistory(term){
    term = term.trim().toLowerCase();
    const branchFilter = $('history-branch-filter').value;
    let rows = allHistoryRows;
    if (branchFilter){
      rows = rows.filter(r => (r.branchName||'') === branchFilter);
    }
    if (!term) return rows;
    return rows.filter(r => {
      const haystack = [
        r.doctorName, r.phone, r.category, r.source, r.branchName, r.employeeEmail,
        ...(r.medicines||[])
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }

  $('history-search').addEventListener('input', (e) => {
    renderHistoryList(filterHistory(e.target.value));
  });
  $('history-branch-filter').addEventListener('change', () => {
    renderHistoryList(filterHistory($('history-search').value));
  });

  function populateHistoryBranchFilter(rows){
    const sel = $('history-branch-filter');
    const current = sel.value;
    const names = Array.from(new Set(rows.map(r => r.branchName).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">All branches</option>' +
      names.map(n => '<option value="'+escapeHtml(n)+'"'+(n===current?' selected':'')+'>'+escapeHtml(n)+'</option>').join('');
  }

  async function loadHistory(){
    const list = $('history-list');
    try{
      const rows = await api('/api/prescriptions');
      allHistoryRows = rows;
      const isOrgReader = currentUser && ['owner','company_admin','viewer'].includes(currentUser.role);
      $('history-branch-filter').style.display = isOrgReader ? 'block' : 'none';
      if (isOrgReader) populateHistoryBranchFilter(rows);
      renderHistoryList(filterHistory($('history-search').value));
    } catch(e){
      list.innerHTML = '<div class="empty-hist">Could not load the list</div>';
    }
  }

  // ---- admin: branches ----
  async function loadBranches(){
    let stats = [];
    try{
      stats = await api('/api/branches/stats');
    } catch(e){
      // fall back to plain list without stats
      const plain = await api('/api/branches');
      stats = plain.map(b => ({ ...b, userCount:0, prescriptionCount:0, scansToday:0, pendingCount:0, approvedCount:0, rejectedCount:0, managerEmail:null }));
    }
    const list = $('branch-list');
    list.innerHTML = stats.map(b => (
      '<div class="branch-card">'+
        '<div class="branch-card-head">'+
          '<div>'+
            '<div class="name"><span class="branch-icon">'+BRANCH_ICON_SVG+'</span>'+escapeHtml(b.name)+'</div>'+
            (b.approved === false ? '<span class="status-badge pending">Pending approval</span>' : '<span class="status-badge approved">Active</span>')+
          '</div>'+
          '<button class="del-btn" data-id="'+b.id+'" title="Delete branch">Delete</button>'+
        '</div>'+
        '<div class="branch-stat-row">'+
          '<div><div class="bs-label">Users</div><div class="bs-value">'+b.userCount+'</div></div>'+
          '<div><div class="bs-label">Prescriptions</div><div class="bs-value">'+b.prescriptionCount+'</div></div>'+
          '<div><div class="bs-label">Scans today</div><div class="bs-value">'+b.scansToday+'</div></div>'+
          '<div><div class="bs-label">Manager</div><div class="bs-value" style="font-size:12.5px;">'+escapeHtml(b.managerEmail||'—')+'</div></div>'+
        '</div>'+
        '<button class="btn-ghost" type="button" data-open-panel="'+b.id+'">Open control panel</button>'+
      '</div>'
    )).join('') || '<div class="empty-hist">No branches</div>';

    list.querySelectorAll('[data-open-panel]').forEach(btn => {
      btn.addEventListener('click', () => openBranchControlPanel(Number(btn.dataset.openPanel), stats));
    });
    list.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await api('/api/branches/'+btn.dataset.id, {method:'DELETE'});
        await loadBranches();
      });
    });
    const sel = $('new-user-branch');
    sel.innerHTML = stats.map(b => '<option value="'+b.id+'">'+escapeHtml(b.name)+(b.approved === false ? ' (pending)' : '')+'</option>').join('');
  }

  function goToBranchHistory(branchName){
    const tabBtn = $('history-tab-btn');
    if (tabBtn) tabBtn.click();
    const filterSel = $('history-branch-filter');
    if (filterSel){
      filterSel.style.display = 'block';
      if (!Array.from(filterSel.options).some(o => o.value === branchName)){
        filterSel.innerHTML += '<option value="'+escapeHtml(branchName)+'">'+escapeHtml(branchName)+'</option>';
      }
      filterSel.value = branchName;
    }
    renderHistoryList(filterHistory($('history-search').value));
  }

  function openBranchControlPanel(id, stats){
    const b = stats.find(x => x.id === id);
    if (!b) return;
    const panel = $('branch-control-panel');
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '14px';
    panel.innerHTML =
      '<div class="card" style="gap:14px;">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;">'+
          '<button class="btn-ghost" type="button" id="branch-panel-back">&larr; Back to branches</button>'+
          (b.approved === false ? '<span class="status-badge pending">Pending approval</span>' : '<span class="status-badge approved">Active</span>')+
        '</div>'+
        '<div><div class="page-header" style="margin:0;"><h2 style="font-size:17px;">'+escapeHtml(b.name)+'</h2><p>Branch manager: '+escapeHtml(b.managerEmail||'Not assigned')+'</p></div></div>'+
        '<div class="stat-grid">'+
          statCard("Today's scans", b.scansToday, 'today')+
          statCard('Total prescriptions', b.prescriptionCount, 'total')+
          statCard('Pending review', b.pendingCount, 'today')+
          statCard('Team members', b.userCount, 'users')+
        '</div>'+
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">'+
          '<button class="btn-primary" type="button" id="branch-panel-view-rx">View prescriptions</button>'+
        '</div>'+
      '</div>';
    $('branch-panel-back').addEventListener('click', () => { panel.style.display = 'none'; panel.innerHTML = ''; });
    $('branch-panel-view-rx').addEventListener('click', () => goToBranchHistory(b.name));
    panel.scrollIntoView({behavior:'smooth', block:'start'});
  }

  $('add-branch-btn').addEventListener('click', async () => {
    const name = $('new-branch-name').value.trim();
    if (!name) return;
    try{
      await api('/api/branches', {method:'POST', body: JSON.stringify({name})});
      $('new-branch-name').value = '';
      await loadBranches();
      showToast('Branch added — pending platform admin approval', 'info');
    } catch(e){
      if (e.body && e.body.error === 'plan_limit_reached'){
        showToast('Your plan allows up to '+e.body.max+' branches. Ask the platform admin to upgrade.', 'error');
      } else {
        showToast('Something went wrong', 'error');
      }
    }
  });

  // ---- admin: users ----
  let allUsersCache = [];

  async function loadUsers(){
    allUsersCache = await api('/api/users');
    const branchNames = Array.from(new Set(allUsersCache.map(u => u.branchName).filter(Boolean))).sort();
    const filterSel = $('user-branch-filter');
    const current = filterSel.value;
    filterSel.innerHTML = '<option value="">Select a branch to view its team</option>' +
      branchNames.map(n => '<option value="'+escapeAttr(n)+'"'+(n===current?' selected':'')+'>'+escapeHtml(n)+'</option>').join('');
    renderUserList();
  }

  function renderUserList(){
    const list = $('user-list');
    const branchFilter = $('user-branch-filter').value;
    if (!branchFilter){
      list.innerHTML = '<div class="empty-hist">Select a branch above to view its team</div>';
      return;
    }
    const users = allUsersCache.filter(u => (u.branchName||'') === branchFilter);
    list.innerHTML = users.map(u =>
      '<div class="admin-row"><span>'+escapeHtml(u.email)+'<div class="meta">'+roleLabel(u.role)+' · '+escapeHtml(u.branchName||'No branch')+'</div></span>'+
      '<div style="display:flex;gap:4px;">'+
      '<button class="approve-btn" data-reset="'+u.id+'" type="button">Reset password</button>'+
      '<button class="del-btn" data-id="'+u.id+'">Delete</button>'+
      '</div></div>'+
      '<div class="reset-row" id="reset-row-'+u.id+'" style="display:none;padding:8px 12px;gap:8px;">'+
        '<input type="text" placeholder="New password" id="reset-input-'+u.id+'" style="flex:1;font-family:inherit;font-size:13.5px;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--paper);" dir="ltr">'+
        '<button class="btn-primary" data-confirm-reset="'+u.id+'" style="padding:8px 16px;">Set</button>'+
      '</div>'
    ).join('') || '<div class="empty-hist">No one on this branch\'s team yet</div>';
    list.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api('/api/users/'+btn.dataset.id, {method:'DELETE'});
        await loadUsers();
      });
    });
    list.querySelectorAll('[data-reset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = document.getElementById('reset-row-'+btn.dataset.reset);
        row.style.display = row.style.display === 'none' ? 'flex' : 'none';
      });
    });
    list.querySelectorAll('[data-confirm-reset]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.confirmReset;
        const input = document.getElementById('reset-input-'+id);
        const val = input.value;
        if (!val || val.length < 4){ showToast('Password must be at least 4 characters', 'error'); return; }
        try{
          await api('/api/users/'+id+'/reset-password', {method:'POST', body: JSON.stringify({newPassword: val})});
          showToast('Password reset', 'success');
          await loadUsers();
        } catch(e){
          showToast('Could not be changed', 'error');
        }
      });
    });
  }

  $('user-branch-filter').addEventListener('change', renderUserList);

  function activityActionLabel(action){
    const map = {
      login: 'Logged in',
      company_registered: 'Company registered',
      branch_created: 'Branch created',
      branch_deleted: 'Branch deleted',
      user_created: 'User created',
      user_deleted: 'User deleted',
      prescription_scanned: 'Prescription scanned',
      prescription_approved: 'Prescription approved',
      prescription_rejected: 'Prescription rejected',
      prescription_deleted: 'Prescription deleted',
      company_created: 'Company created',
      company_status_changed: 'Company status changed',
      company_plan_changed: 'Company plan changed',
      company_deleted: 'Company deleted',
    };
    return map[action] || action;
  }

  async function loadActivityLog(){
    try{
      const logs = await api('/api/activity-logs');
      $('activity-log-list').innerHTML = logs.map(l => {
        const when = new Date(l.createdAt).toLocaleString();
        return '<div class="admin-row" style="flex-direction:column;align-items:stretch;gap:2px;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+escapeHtml(activityActionLabel(l.action))+'</b><span class="meta">'+escapeHtml(when)+'</span></div>'+
          '<span class="meta">'+escapeHtml(l.userEmail||'—')+(l.details ? ' · '+escapeHtml(l.details) : '')+'</span>'+
        '</div>';
      }).join('') || '<div class="empty-hist">No activity yet</div>';
    } catch(e){
      $('activity-log-list').innerHTML = '<div class="empty-hist">Could not load the activity log</div>';
    }
  }

  $('add-user-btn').addEventListener('click', async () => {
    const email = $('new-user-email').value.trim();
    const password = $('new-user-password').value;
    const role = $('new-user-role').value;
    const branchId = Number($('new-user-branch').value) || null;
    if (!email || !password) return;
    try{
      await api('/api/users', {method:'POST', body: JSON.stringify({email, password, role, branchId})});
      $('new-user-email').value=''; $('new-user-password').value='';
      await loadUsers();
      showToast('User added', 'success');
    } catch(e){
      if (e.body && e.body.error === 'plan_limit_reached'){
        showToast('Your plan allows up to '+e.body.max+' users. Ask the platform admin to upgrade.', 'error');
      } else {
        showToast('That email is already taken, or something went wrong', 'error');
      }
    }
  });

  // ---- reports ----
  function reportRow(name, count){
    return '<div class="admin-row"><span>'+escapeHtml(name)+'</span><span class="meta">'+count+'</span></div>';
  }

  function statCard(label, value, kind){
    const icons = {
      total: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
      today: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      company: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M14 9h1M14 13h1"/>',
      active: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
      users: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
      revenue: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    };
    return '<div class="stat-card">'+
      '<div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(icons[kind]||icons.total)+'</svg></div>'+
      '<span class="stat-label">'+escapeHtml(label)+'</span>'+
      '<span class="stat-value">'+value+'</span>'+
    '</div>';
  }

  function renderBarChart(svgId, data, opts){
    opts = opts || {};
    const svg = $(svgId);
    if (!svg) return;
    if (!data.length){ svg.setAttribute('height', 1); svg.innerHTML=''; return; }
    const max = Math.max.apply(null, data.map(d => d.count).concat([1]));
    let html = '';
    if (opts.horizontal){
      const rowH = 24, gap = 8, labelW = 100, chartW = 220;
      const height = data.length*(rowH+gap);
      svg.setAttribute('viewBox', '0 0 380 '+height);
      svg.setAttribute('height', height);
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
      data.forEach((d,i) => {
        const y = i*(rowH+gap);
        const barW = Math.max((d.count/max) * chartW, 2);
        html += '<text x="0" y="'+(y+rowH/2+4)+'" font-size="11.5" fill="var(--ink-soft)">'+escapeHtml((d.name||'').slice(0,14))+'</text>';
        html += '<rect x="'+labelW+'" y="'+y+'" width="'+barW+'" height="'+rowH+'" rx="5" fill="var(--amber)"></rect>';
        html += '<text x="'+(labelW+barW+8)+'" y="'+(y+rowH/2+4)+'" font-size="11.5" fill="var(--ink)">'+d.count+'</text>';
      });
    } else {
      const barW = 20, gap = 8, chartH = 100, labelH = 18;
      const width = data.length*(barW+gap);
      svg.setAttribute('viewBox', '0 0 '+width+' '+(chartH+labelH+16));
      svg.setAttribute('height', chartH+labelH+16);
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
      data.forEach((d,i) => {
        const x = i*(barW+gap);
        const barH = Math.max((d.count/max) * chartH, 2);
        html += '<rect x="'+x+'" y="'+(chartH-barH)+'" width="'+barW+'" height="'+barH+'" rx="4" fill="var(--amber)"></rect>';
        html += '<text x="'+(x+barW/2)+'" y="'+(chartH+14)+'" font-size="9.5" text-anchor="middle" fill="var(--ink-soft)">'+escapeHtml((d.name||'').slice(5))+'</text>';
        html += '<text x="'+(x+barW/2)+'" y="'+(chartH-barH-4)+'" font-size="9.5" text-anchor="middle" fill="var(--ink)">'+d.count+'</text>';
      });
    }
    svg.innerHTML = html;
  }

  let allDoctorRows = [];

  function renderDoctorList(rows){
    const doctorList = $('report-by-doctor');
    doctorList.innerHTML = rows.map(r =>
      '<div class="admin-row" style="cursor:pointer;" data-doctor="'+escapeAttr(r.name)+'"><span>'+escapeHtml(r.name)+'</span><span class="meta">'+r.count+'</span></div>'
    ).join('') || '<div class="empty-hist">None</div>';
    doctorList.querySelectorAll('[data-doctor]').forEach(row => {
      row.addEventListener('click', () => loadDoctorDetail(row.dataset.doctor));
    });
  }

  $('doctor-search').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    renderDoctorList(term ? allDoctorRows.filter(r => r.name.toLowerCase().includes(term)) : allDoctorRows);
  });

  async function loadReports(){
    try{
      const data = await api('/api/reports/overview');
      const todayCount = (data.byDay||[]).find(r => r.name === new Date().toISOString().slice(0,10))?.count || 0;
      $('report-total').innerHTML = statCard('Total orders', data.total, 'total') + statCard("Today's scans", todayCount, 'today');
      $('report-by-branch').innerHTML = data.byBranch.map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      $('report-by-employee').innerHTML = data.byEmployee.map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      $('report-by-category').innerHTML = (data.byCategory||[]).map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      renderBarChart('chart-by-category', data.byCategory||[], {horizontal:true});
      $('report-by-source').innerHTML = (data.bySource||[]).map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      $('report-by-year').innerHTML = (data.byYear||[]).map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      $('report-by-month').innerHTML = (data.byMonth||[]).map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      renderBarChart('chart-by-month', (data.byMonth||[]).slice(0,12).reverse(), {horizontal:false});
      $('report-by-day').innerHTML = (data.byDay||[]).slice(0,30).map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      $('report-top-medicines').innerHTML = data.topMedicines.map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';

      allDoctorRows = data.byDoctor;
      renderDoctorList(allDoctorRows);
    } catch(e){
      $('report-total').innerHTML = '<div class="empty-hist">Could not load the report</div>';
    }
  }

  async function loadDoctorDetail(name){
    const section = $('doctor-detail-section');
    const list = $('doctor-detail-list');
    $('doctor-detail-title').textContent = 'Details: ' + name;
    section.style.display = 'flex';
    section.scrollIntoView({behavior:'smooth', block:'start'});
    try{
      const data = await api('/api/reports/doctor?name=' + encodeURIComponent(name));
      if (!data.prescriptions.length){ list.innerHTML = '<div class="empty-hist">No orders</div>'; return; }
      list.innerHTML = data.prescriptions.map(p => {
        const dateStr = new Date(p.createdAt).toLocaleDateString('ckb', {year:'numeric', month:'short', day:'numeric'});
        return '<div class="admin-row" style="align-items:flex-start;flex-direction:column;gap:4px;">'+
          '<span>'+escapeHtml(p.branchName||'—')+' · '+escapeHtml(p.employeeEmail||'—')+' · '+escapeHtml(p.category||'Medicine')+' · '+escapeHtml(p.source||'Private')+' · '+escapeHtml(dateStr)+'</span>'+
          '<span class="meta">'+(p.medicines.length ? escapeHtml(p.medicines.join(', ')) : 'No items recorded')+'</span>'+
        '</div>';
      }).join('');
    } catch(e){
      list.innerHTML = '<div class="empty-hist">Could not be loaded</div>';
    }
  }
})();
