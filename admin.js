(function () {
    let original = window.trocarTela;
    window.trocarTela = function (id) {
        original(id);
        document.querySelectorAll(".navDesktop [data-tela]").forEach(b => {
            b.classList.toggle("navAtivo", b.dataset.tela === id);
        });
    };

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll(".navDesktop [data-tela]").forEach(b => {
            b.classList.toggle("navAtivo", b.dataset.tela === "telaDashboard");
        });
        if (!obterToken()) {
            setTimeout(abrirModalLogin, 300);
        }
    });

    // atualização periódica: tela de gerenciamento fica sempre com dado fresco
    setInterval(() => {
        if (document.visibilityState === "visible") {
            sincronizarAgora();
        }
    }, 60000);
})();

// ========================================
// GERENCIAMENTO DE USUÁRIOS
// ========================================
let usuarioEditandoId = null;

async function carregarUsuarios() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaUsuarios");
    if (!token || !corpo) return;

    try {
        let resp = await fetch(`${API_URL}/api/usuarios`, {
            headers: { "Authorization": "Bearer " + token }
        });
        if (!resp.ok) {
            corpo.innerHTML = `<tr><td colspan="5">Acesso restrito a administradores, ou sessão expirada.</td></tr>`;
            return;
        }
        let usuarios = await resp.json();
        corpo.innerHTML = usuarios.map(u => `
            <tr>
                <td>${u.nome}</td>
                <td>${u.usuario}</td>
                <td>${u.papel === "admin" ? "Administrador" : "Operador"}</td>
                <td>${u.ativo ? "✅ Ativo" : "🚫 Inativo"}</td>
                <td class="acoesUsuario">
                    <button onclick='abrirModalUsuario(${JSON.stringify(u.id)}, ${JSON.stringify(u.nome)}, ${JSON.stringify(u.usuario)}, ${JSON.stringify(u.papel)})'>✏️</button>
                    <button onclick='alternarAtivoUsuario(${JSON.stringify(u.id)}, ${!u.ativo})'>${u.ativo ? "🚫" : "✅"}</button>
                    <button onclick='excluirUsuario(${JSON.stringify(u.id)}, ${JSON.stringify(u.nome)})'>🗑️</button>
                </td>
            </tr>
        `).join("");
    } catch (e) {
        corpo.innerHTML = `<tr><td colspan="5">Erro ao carregar usuários.</td></tr>`;
    }
}

function abrirModalUsuario(id, nome, usuario, papel) {
    usuarioEditandoId = id || null;
    document.getElementById("modalUsuarioTitulo").innerText = id ? "✏️ Editar Usuário" : "➕ Novo Usuário";
    document.getElementById("usuarioNomeInput").value = nome || "";
    document.getElementById("usuarioLoginInput").value = usuario || "";
    document.getElementById("usuarioLoginInput").disabled = !!id;
    document.getElementById("usuarioSenhaInput").value = "";
    document.getElementById("usuarioSenhaInput").placeholder = id ? "Nova senha (deixe em branco pra manter)" : "Senha";
    document.getElementById("usuarioPapelInput").value = papel || "operador";
    let erroEl = document.getElementById("usuarioErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalUsuario").style.display = "flex";
}

function fecharModalUsuario() {
    document.getElementById("modalUsuario").style.display = "none";
    usuarioEditandoId = null;
}

async function salvarUsuario() {
    let token = obterToken();
    let nome = document.getElementById("usuarioNomeInput").value.trim();
    let usuario = document.getElementById("usuarioLoginInput").value.trim();
    let senha = document.getElementById("usuarioSenhaInput").value;
    let papel = document.getElementById("usuarioPapelInput").value;
    let erroEl = document.getElementById("usuarioErro");

    function mostrarErro(msg) {
        if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; }
    }

    if (!nome || !usuario || (!usuarioEditandoId && !senha)) {
        mostrarErro("Preencha todos os campos.");
        return;
    }

    try {
        let resp;
        if (usuarioEditandoId) {
            let corpo = { nome, papel };
            if (senha) corpo.senha = senha;
            resp = await fetch(`${API_URL}/api/usuarios/${usuarioEditandoId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(corpo)
            });
        } else {
            resp = await fetch(`${API_URL}/api/usuarios`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify({ nome, usuario, senha, papel })
            });
        }
        let dados = await resp.json();
        if (!resp.ok) {
            mostrarErro(dados.erro || "Erro ao salvar usuário.");
            return;
        }
        fecharModalUsuario();
        carregarUsuarios();
    } catch (e) {
        mostrarErro("Erro de conexão.");
    }
}

async function alternarAtivoUsuario(id, novoAtivo) {
    let token = obterToken();
    if (!confirm(novoAtivo ? "Reativar este usuário?" : "Desativar este usuário? Ele não conseguirá mais entrar.")) return;

    let resp = await fetch(`${API_URL}/api/usuarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ ativo: novoAtivo })
    });
    let dados = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        alert(dados.erro || "Erro ao atualizar usuário.");
        return;
    }
    carregarUsuarios();
}

async function excluirUsuario(id, nome) {
    let token = obterToken();
    if (!confirm(`Excluir o usuário "${nome}" permanentemente?`)) return;

    let resp = await fetch(`${API_URL}/api/usuarios/${id}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
    });
    let dados = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        alert(dados.erro || "Erro ao excluir usuário.");
        return;
    }
    carregarUsuarios();
}
