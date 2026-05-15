// Fichier : /js/dash/drive.js
// Mock utilisateur et fichiers
const user = {
    plan: 'pro', // 'pro' ou 'label'
    used: 2.3, // Go utilisés
};
const quotas = {
    pro: 10,
    label: 20
};
const mockFiles = [
    { name: 'Dossier Musique', type: 'dossier', size: '-', date: '2026-03-20' },
    { name: 'Contrat.pdf', type: 'pdf', size: '1.2 Mo', date: '2026-03-21' },
    { name: 'Cover.jpg', type: 'image', size: '2.1 Mo', date: '2026-03-22' },
];

function updateDriveInfo() {
    const planType = user.plan === 'pro' ? 'Pro (10 Go)' : 'Label (20 Go)';
    document.getElementById('plan-type').textContent = `Plan : ${planType}`;
    document.getElementById('quota').textContent = `Espace utilisé : ${user.used} Go / ${quotas[user.plan]} Go`;
}

function renderFiles() {
    const tbody = document.getElementById('file-list');
    tbody.innerHTML = '';
    mockFiles.forEach(file => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${file.name}</td>
            <td>${file.size}</td>
            <td>${file.type}</td>
            <td>${file.date}</td>
        `;
        tbody.appendChild(tr);
    });
}

function checkAccess() {
    if (user.plan !== 'pro' && user.plan !== 'label') {
        document.body.innerHTML = '<h2>Accès réservé aux membres Pro et Label.</h2>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAccess();
    updateDriveInfo();
    renderFiles();
});
