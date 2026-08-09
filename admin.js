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
                <td>${u.papel === "admin" ? "—" : `
                    <span class="tagPermissao">${rotuloPermTipo(u.permissaoTipoPesagem)}</span>
                    <span class="tagPermissao">Dash: ${rotuloPermEscopo(u.permissaoDashboard)}</span>
                    <span class="tagPermissao">Rel: ${rotuloPermEscopo(u.permissaoRelatorios)}</span>
                    ${u.valorMaximoCompra !== null && u.valorMaximoCompra !== undefined ? `<span class="tagPermissao">Máx compra: ${formatarValorReais(u.valorMaximoCompra)}</span>` : ""}
                    ${u.permissaoAlmoxarifado ? `<span class="tagPermissao">📦 Almoxarifado</span>` : ""}
                `}</td>
                <td>${u.ativo ? "✅ Ativo" : "🚫 Inativo"}</td>
                <td class="acoesUsuario">
                    <button onclick='abrirModalUsuario(${JSON.stringify(u)})'>✏️</button>
                    <button onclick='alternarAtivoUsuario(${JSON.stringify(u.id)}, ${!u.ativo})'>${u.ativo ? "🚫" : "✅"}</button>
                    <button onclick='excluirUsuario(${JSON.stringify(u.id)}, ${JSON.stringify(u.nome)})'>🗑️</button>
                </td>
            </tr>
        `).join("");
    } catch (e) {
        corpo.innerHTML = `<tr><td colspan="6">Erro ao carregar usuários.</td></tr>`;
    }
}

function rotuloPermTipo(v) {
    if (v === "venda") return "Só Venda";
    if (v === "compra") return "Só Compra";
    return "Venda+Compra";
}

function rotuloPermEscopo(v) {
    return v === "proprio" ? "Próprio" : "Geral";
}

function formatarValorReais(n) {
    return "R$ " + formatarMoeda(n);
}

function alternarCamposPermissao() {
    let bloco = document.getElementById("blocoPermissoesUsuario");
    let ehAdmin = document.getElementById("usuarioPapelInput").value === "admin";
    if (bloco) bloco.style.display = ehAdmin ? "none" : "block";
}

function abrirModalUsuario(usuarioExistente) {
    usuarioEditandoId = usuarioExistente ? usuarioExistente.id : null;
    document.getElementById("modalUsuarioTitulo").innerText = usuarioEditandoId ? "✏️ Editar Usuário" : "➕ Novo Usuário";
    document.getElementById("usuarioNomeInput").value = usuarioExistente ? usuarioExistente.nome : "";
    document.getElementById("usuarioLoginInput").value = usuarioExistente ? usuarioExistente.usuario : "";
    document.getElementById("usuarioLoginInput").disabled = !!usuarioEditandoId;
    document.getElementById("usuarioSenhaInput").value = "";
    document.getElementById("usuarioSenhaInput").placeholder = usuarioEditandoId ? "Nova senha (deixe em branco pra manter)" : "Senha";
    document.getElementById("usuarioPapelInput").value = (usuarioExistente && usuarioExistente.papel) || "operador";
    document.getElementById("usuarioPermTipoInput").value = (usuarioExistente && usuarioExistente.permissaoTipoPesagem) || "ambos";
    document.getElementById("usuarioPermDashboardInput").value = (usuarioExistente && usuarioExistente.permissaoDashboard) || "geral";
    document.getElementById("usuarioPermRelatoriosInput").value = (usuarioExistente && usuarioExistente.permissaoRelatorios) || "geral";
    document.getElementById("usuarioValorMaxCompraInput").value = (usuarioExistente && usuarioExistente.valorMaximoCompra !== null && usuarioExistente.valorMaximoCompra !== undefined)
        ? String(usuarioExistente.valorMaximoCompra).replace(".", ",")
        : "";
    document.getElementById("usuarioPermAlmoxarifadoInput").checked = !!(usuarioExistente && usuarioExistente.permissaoAlmoxarifado);
    alternarCamposPermissao();
    let erroEl = document.getElementById("usuarioErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalUsuario").style.display = "flex";
}

function fecharModalUsuario() {
    document.getElementById("modalUsuario").style.display = "none";
    usuarioEditandoId = null;
}

async function salvarUsuario() {
    let erroEl = document.getElementById("usuarioErro");
    function mostrarErro(msg) {
        if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; }
    }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou. Feche este aviso e entre de novo."); return; }

        let nome = document.getElementById("usuarioNomeInput").value.trim();
        let usuario = document.getElementById("usuarioLoginInput").value.trim();
        let senha = document.getElementById("usuarioSenhaInput").value;
        let papel = document.getElementById("usuarioPapelInput").value;
        let permissaoTipoPesagem = document.getElementById("usuarioPermTipoInput").value;
        let permissaoDashboard = document.getElementById("usuarioPermDashboardInput").value;
        let permissaoRelatorios = document.getElementById("usuarioPermRelatoriosInput").value;
        let valorMaxTexto = document.getElementById("usuarioValorMaxCompraInput").value.trim();
        let valorMaximoCompra = valorMaxTexto ? parseFloat(valorMaxTexto.replace(/\./g, "").replace(",", ".")) : null;
        if (valorMaxTexto && !Number.isFinite(valorMaximoCompra)) {
            mostrarErro("Valor máximo de compra inválido.");
            return;
        }
        let permissaoAlmoxarifado = document.getElementById("usuarioPermAlmoxarifadoInput").checked;

        if (!nome || !usuario || (!usuarioEditandoId && !senha)) {
            mostrarErro("Preencha todos os campos.");
            return;
        }

        let resp;
        if (usuarioEditandoId) {
            let corpo = { nome, papel, permissaoTipoPesagem, permissaoDashboard, permissaoRelatorios, valorMaximoCompra, permissaoAlmoxarifado };
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
                body: JSON.stringify({ nome, usuario, senha, papel, permissaoTipoPesagem, permissaoDashboard, permissaoRelatorios, valorMaximoCompra, permissaoAlmoxarifado })
            });
        }
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            mostrarErro(dados.erro || `Erro ao salvar usuário (HTTP ${resp.status}).`);
            return;
        }
        fecharModalUsuario();
        carregarUsuarios();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function alternarAtivoUsuario(id, novoAtivo) {
    if (!confirm(novoAtivo ? "Reativar este usuário?" : "Desativar este usuário? Ele não conseguirá mais entrar.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/usuarios/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(dados.erro || `Erro ao atualizar usuário (HTTP ${resp.status}).`);
            return;
        }
        carregarUsuarios();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirUsuario(id, nome) {
    if (!confirm(`Excluir o usuário "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/usuarios/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(dados.erro || `Erro ao excluir usuário (HTTP ${resp.status}).`);
            return;
        }
        carregarUsuarios();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

// ========================================
// GERENCIAMENTO DE LOTES
// ========================================
let loteEditandoId = null;

async function carregarLotes() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaLotes");
    if (!token || !corpo) return;

    try {
        let resp = await fetch(`${API_URL}/api/lotes`, {
            headers: { "Authorization": "Bearer " + token }
        });
        if (!resp.ok) {
            corpo.innerHTML = `<tr><td colspan="3">Sessão expirada ou sem acesso.</td></tr>`;
            return;
        }
        let lotes = await resp.json();
        if (lotes.length === 0) {
            corpo.innerHTML = `<tr><td colspan="3">Nenhum lote cadastrado ainda.</td></tr>`;
            return;
        }
        corpo.innerHTML = lotes.map(l => `
            <tr>
                <td>${l.nome}</td>
                <td>${l.ativo ? "✅ Ativo" : "🚫 Inativo"}</td>
                <td class="acoesUsuario">
                    <button onclick='abrirModalLote(${JSON.stringify(l)})'>✏️</button>
                    <button onclick='alternarAtivoLote(${JSON.stringify(l.id)}, ${!l.ativo})'>${l.ativo ? "🚫" : "✅"}</button>
                    <button onclick='excluirLote(${JSON.stringify(l.id)}, ${JSON.stringify(l.nome)})'>🗑️</button>
                </td>
            </tr>
        `).join("");
    } catch (e) {
        corpo.innerHTML = `<tr><td colspan="3">Erro ao carregar lotes.</td></tr>`;
    }
}

function abrirModalLote(loteExistente) {
    loteEditandoId = loteExistente ? loteExistente.id : null;
    document.getElementById("modalLoteTitulo").innerText = loteEditandoId ? "✏️ Editar Lote" : "➕ Novo Lote";
    document.getElementById("loteNomeInput").value = loteExistente ? loteExistente.nome : "";
    let erroEl = document.getElementById("loteErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalLote").style.display = "flex";
}

function fecharModalLote() {
    document.getElementById("modalLote").style.display = "none";
    loteEditandoId = null;
}

async function salvarLote() {
    let erroEl = document.getElementById("loteErro");
    function mostrarErro(msg) {
        if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; }
    }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou. Feche este aviso e entre de novo."); return; }

        let nome = document.getElementById("loteNomeInput").value.trim();
        if (!nome) { mostrarErro("Informe o nome do lote."); return; }

        let resp;
        if (loteEditandoId) {
            resp = await fetch(`${API_URL}/api/lotes/${loteEditandoId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify({ nome })
            });
        } else {
            resp = await fetch(`${API_URL}/api/lotes`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify({ nome })
            });
        }
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            mostrarErro(dados.erro || `Erro ao salvar lote (HTTP ${resp.status}).`);
            return;
        }
        fecharModalLote();
        carregarLotes();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function alternarAtivoLote(id, novoAtivo) {
    if (!confirm(novoAtivo ? "Reativar este lote?" : "Desativar este lote? Ele deixa de aparecer na lista do celular.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/lotes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(dados.erro || `Erro ao atualizar lote (HTTP ${resp.status}).`);
            return;
        }
        carregarLotes();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirLote(id, nome) {
    if (!confirm(`Excluir o lote "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/lotes/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(dados.erro || `Erro ao excluir lote (HTTP ${resp.status}).`);
            return;
        }
        carregarLotes();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

// ========================================
// ALMOXARIFADO — DEPARTAMENTOS
// ========================================
let departamentosCacheAdmin = [];

async function carregarDepartamentosAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/departamentos`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        departamentosCacheAdmin = await resp.json();
        return departamentosCacheAdmin;
    } catch (e) {
        return [];
    }
}

function preencherSelectDepartamentos(select, valorSelecionado) {
    if (!select) return;
    select.innerHTML = `<option value="">Sem departamento</option>` +
        departamentosCacheAdmin.filter(d => d.ativo).map(d => `<option value="${d.id}">${d.nome}</option>`).join("");
    select.value = valorSelecionado || "";
}

async function abrirModalDepartamento() {
    await carregarDepartamentosModal();
    let erroEl = document.getElementById("departamentoErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("departamentoNomeInput").value = "";
    document.getElementById("modalDepartamento").style.display = "flex";
}

function fecharModalDepartamento() {
    document.getElementById("modalDepartamento").style.display = "none";
    // reflete no select do modal de produto qualquer mudança feita aqui (novo/desativado)
    let selectProduto = document.getElementById("produtoDepartamentoInput");
    if (selectProduto) preencherSelectDepartamentos(selectProduto, selectProduto.value);
}

async function carregarDepartamentosModal() {
    let token = obterToken();
    let lista = document.getElementById("listaDepartamentosModal");
    if (!token || !lista) return;
    await carregarDepartamentosAdmin();
    if (departamentosCacheAdmin.length === 0) {
        lista.innerHTML = `<p style="font-size:13px;color:#999;padding:8px 0">Nenhum departamento cadastrado ainda.</p>`;
        return;
    }
    lista.innerHTML = departamentosCacheAdmin.map(d => `
        <div class="itemDepartamentoModal">
            <span>${d.nome}${d.ativo ? "" : " (inativo)"}</span>
            <span>
                <button onclick='alternarAtivoDepartamento(${JSON.stringify(d.id)}, ${!d.ativo})'>${d.ativo ? "🚫" : "✅"}</button>
                <button onclick='excluirDepartamento(${JSON.stringify(d.id)}, ${JSON.stringify(d.nome)})'>🗑️</button>
            </span>
        </div>
    `).join("");
}

async function salvarDepartamento() {
    let erroEl = document.getElementById("departamentoErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }
    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }
        let nome = document.getElementById("departamentoNomeInput").value.trim();
        if (!nome) { mostrarErro("Informe o nome do departamento."); return; }
        let resp = await fetch(`${API_URL}/api/departamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ nome })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao criar departamento (HTTP ${resp.status}).`); return; }
        document.getElementById("departamentoNomeInput").value = "";
        await carregarDepartamentosModal();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function alternarAtivoDepartamento(id, novoAtivo) {
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/departamentos/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao atualizar departamento (HTTP ${resp.status}).`); return; }
        await carregarDepartamentosModal();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirDepartamento(id, nome) {
    if (!confirm(`Excluir o departamento "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/departamentos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir departamento (HTTP ${resp.status}).`); return; }
        await carregarDepartamentosModal();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

// ========================================
// ALMOXARIFADO — PRODUTOS
// ========================================
let produtoEditandoId = null;
let produtosCacheAdmin = [];

async function carregarProdutosAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/produtos`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        produtosCacheAdmin = await resp.json();
        return produtosCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function carregarProdutos() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaProdutos");
    if (!token || !corpo) return;

    await carregarDepartamentosAdmin();
    await carregarProdutosAdmin();
    if (produtosCacheAdmin.length === 0) {
        corpo.innerHTML = `<tr><td colspan="8">Nenhum produto cadastrado ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = produtosCacheAdmin.map(p => `
        <tr>
            <td>${p.descricao}</td>
            <td>${p.codigoBarra || "—"}</td>
            <td>${p.departamentoNome || "—"}</td>
            <td>${p.unidade}</td>
            <td>${formatarPeso(p.saldoAtual)}</td>
            <td>R$ ${formatarMoeda(p.custoMedioUnitario)}</td>
            <td>${p.ativo ? "✅ Ativo" : "🚫 Inativo"}</td>
            <td class="acoesUsuario">
                <button onclick='abrirModalProduto(${JSON.stringify(p)})'>✏️</button>
                <button onclick='alternarAtivoProduto(${JSON.stringify(p.id)}, ${!p.ativo})'>${p.ativo ? "🚫" : "✅"}</button>
                <button onclick='excluirProduto(${JSON.stringify(p.id)}, ${JSON.stringify(p.descricao)})'>🗑️</button>
            </td>
        </tr>
    `).join("");
}

async function abrirModalProduto(produtoExistente) {
    await carregarDepartamentosAdmin();
    produtoEditandoId = produtoExistente ? produtoExistente.id : null;
    document.getElementById("modalProdutoTitulo").innerText = produtoEditandoId ? "✏️ Editar Produto" : "➕ Novo Produto";
    document.getElementById("produtoDescricaoInput").value = produtoExistente ? produtoExistente.descricao : "";
    document.getElementById("produtoCodigoBarraInput").value = produtoExistente ? (produtoExistente.codigoBarra || "") : "";
    document.getElementById("produtoUnidadeInput").value = produtoExistente ? produtoExistente.unidade : "";
    preencherSelectDepartamentos(document.getElementById("produtoDepartamentoInput"), produtoExistente ? produtoExistente.departamentoId : "");
    let erroEl = document.getElementById("produtoErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalProduto").style.display = "flex";
}

function fecharModalProduto() {
    document.getElementById("modalProduto").style.display = "none";
    produtoEditandoId = null;
}

async function salvarProduto() {
    let erroEl = document.getElementById("produtoErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou. Feche este aviso e entre de novo."); return; }

        let descricao = document.getElementById("produtoDescricaoInput").value.trim();
        let codigoBarra = document.getElementById("produtoCodigoBarraInput").value.trim();
        let departamentoId = document.getElementById("produtoDepartamentoInput").value;
        let unidade = document.getElementById("produtoUnidadeInput").value.trim();

        if (!descricao) { mostrarErro("Informe a descrição do produto."); return; }

        let corpo = { descricao, codigoBarra: codigoBarra || null, departamentoId: departamentoId || null, unidade: unidade || "unidade" };
        let resp;
        if (produtoEditandoId) {
            resp = await fetch(`${API_URL}/api/produtos/${produtoEditandoId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(corpo)
            });
        } else {
            resp = await fetch(`${API_URL}/api/produtos`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(corpo)
            });
        }
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar produto (HTTP ${resp.status}).`); return; }
        fecharModalProduto();
        carregarProdutos();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function alternarAtivoProduto(id, novoAtivo) {
    if (!confirm(novoAtivo ? "Reativar este produto?" : "Desativar este produto? Ele deixa de aparecer pra seleção de estoque/saída.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/produtos/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao atualizar produto (HTTP ${resp.status}).`); return; }
        carregarProdutos();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirProduto(id, descricao) {
    if (!confirm(`Excluir o produto "${descricao}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/produtos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir produto (HTTP ${resp.status}).`); return; }
        carregarProdutos();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

// ========================================
// ALMOXARIFADO — ESTOQUE (ENTRADAS)
// ========================================
async function carregarEstoque() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaEstoqueSaldo");
    if (!token || !corpo) return;
    await carregarProdutosAdmin();
    let ativos = produtosCacheAdmin.filter(p => p.ativo);
    if (ativos.length === 0) {
        corpo.innerHTML = `<tr><td colspan="3">Nenhum produto ativo cadastrado ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = ativos.map(p => `
        <tr>
            <td>${p.descricao}</td>
            <td>${formatarPeso(p.saldoAtual)} ${p.unidade}</td>
            <td>R$ ${formatarMoeda(p.custoMedioUnitario)}</td>
        </tr>
    `).join("");
}

async function abrirModalEstoqueEntrada() {
    await carregarProdutosAdmin();
    let select = document.getElementById("entradaProdutoInput");
    select.innerHTML = `<option value="">Selecione o produto</option>` +
        produtosCacheAdmin.filter(p => p.ativo).map(p => `<option value="${p.id}">${p.descricao}</option>`).join("");
    document.getElementById("entradaQuantidadeInput").value = "";
    document.getElementById("entradaValorUnitarioInput").value = "";
    document.getElementById("entradaNumeroNotaInput").value = "";
    atualizarPreviewEntrada();
    let erroEl = document.getElementById("entradaErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalEstoqueEntrada").style.display = "flex";
}

function fecharModalEstoqueEntrada() {
    document.getElementById("modalEstoqueEntrada").style.display = "none";
}

function atualizarPreviewEntrada() {
    let qtd = parseFloat(document.getElementById("entradaQuantidadeInput").value.replace(",", ".")) || 0;
    let valorUnit = parseFloat(document.getElementById("entradaValorUnitarioInput").value.replace(",", ".")) || 0;
    let preview = document.getElementById("entradaPreviewTotal");
    if (preview) preview.innerText = (qtd > 0 && valorUnit > 0) ? `Total: R$ ${formatarMoeda(qtd * valorUnit)}` : "";
}

async function salvarEstoqueEntrada() {
    let erroEl = document.getElementById("entradaErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }
    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let produtoId = document.getElementById("entradaProdutoInput").value;
        let quantidade = parseFloat(document.getElementById("entradaQuantidadeInput").value.replace(",", "."));
        let valorUnitario = parseFloat(document.getElementById("entradaValorUnitarioInput").value.replace(",", "."));
        let numeroNota = document.getElementById("entradaNumeroNotaInput").value.trim();

        if (!produtoId) { mostrarErro("Selecione um produto."); return; }
        if (!Number.isFinite(quantidade) || quantidade <= 0) { mostrarErro("Quantidade inválida."); return; }
        if (!Number.isFinite(valorUnitario) || valorUnitario < 0) { mostrarErro("Valor unitário inválido."); return; }

        let resp = await fetch(`${API_URL}/api/estoque-entradas`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ produtoId, quantidade, valorUnitario, numeroNota: numeroNota || null, data: new Date().toLocaleString("pt-BR") })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao registrar entrada (HTTP ${resp.status}).`); return; }
        fecharModalEstoqueEntrada();
        carregarEstoque();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

// ========================================
// ALMOXARIFADO — SAÍDA DE ESTOQUE (DESKTOP)
// ========================================
let estoqueSaidasCacheAdmin = [];

async function carregarEstoqueSaidasAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/estoque-saidas`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        estoqueSaidasCacheAdmin = await resp.json();
        return estoqueSaidasCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function abrirTelaSaidaEstoqueDesktop() {
    let token = obterToken();
    if (!token) return;

    let lotes = await fetch(`${API_URL}/api/lotes`, { headers: { "Authorization": "Bearer " + token } }).then(r => r.ok ? r.json() : []);
    await carregarProdutosAdmin();

    let selectLote = document.getElementById("saidaLoteInput");
    selectLote.innerHTML = `<option value="">Selecione o lote</option>` +
        lotes.filter(l => l.ativo).map(l => `<option value="${l.nome.replace(/"/g, "&quot;")}">${l.nome}</option>`).join("");

    let selectProduto = document.getElementById("saidaProdutoInput");
    selectProduto.innerHTML = `<option value="">Selecione o produto</option>` +
        produtosCacheAdmin.filter(p => p.ativo).map(p => `<option value="${p.id}">${p.descricao}</option>`).join("");

    document.getElementById("saidaQuantidadeInput").value = "";
    let erroEl = document.getElementById("saidaErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    atualizarPreviewSaidaDesktop();
    carregarHistoricoSaidas();
}

function atualizarPreviewSaidaDesktop() {
    let produtoId = document.getElementById("saidaProdutoInput").value;
    let qtd = parseFloat(document.getElementById("saidaQuantidadeInput").value.replace(",", ".")) || 0;
    let preview = document.getElementById("saidaPreview");
    if (!preview) return;

    let produto = produtosCacheAdmin.find(p => p.id === produtoId);
    if (!produto) { preview.innerText = ""; return; }

    let texto = `Estoque disponível: ${formatarPeso(produto.saldoAtual)} ${produto.unidade} · Custo médio: R$ ${formatarMoeda(produto.custoMedioUnitario)}`;
    if (qtd > 0) texto += ` · Total estimado: R$ ${formatarMoeda(qtd * produto.custoMedioUnitario)}`;
    preview.innerText = texto;
}

async function confirmarSaidaEstoqueDesktop() {
    let erroEl = document.getElementById("saidaErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let loteNome = document.getElementById("saidaLoteInput").value;
        let produtoId = document.getElementById("saidaProdutoInput").value;
        let quantidade = parseFloat(document.getElementById("saidaQuantidadeInput").value.replace(",", "."));

        if (!loteNome) { mostrarErro("Selecione o lote."); return; }
        if (!produtoId) { mostrarErro("Selecione o produto."); return; }
        if (!Number.isFinite(quantidade) || quantidade <= 0) { mostrarErro("Quantidade inválida."); return; }

        let id = crypto.randomUUID();
        let resp = await fetch(`${API_URL}/api/estoque-saidas/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ saidas: [{ id, produtoId, loteNome, quantidade, data: new Date().toLocaleString("pt-BR") }] })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao registrar saída (HTTP ${resp.status}).`); return; }
        if (dados.idsRejeitados && dados.idsRejeitados.includes(id)) {
            mostrarErro("Estoque insuficiente para essa saída.");
            return;
        }

        document.getElementById("saidaQuantidadeInput").value = "";
        await carregarProdutosAdmin();
        atualizarPreviewSaidaDesktop();
        await carregarHistoricoSaidas();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function carregarHistoricoSaidas() {
    let corpo = document.getElementById("corpoTabelaSaidas");
    if (!corpo) return;
    await carregarEstoqueSaidasAdmin();
    if (estoqueSaidasCacheAdmin.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6">Nenhuma saída registrada ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = estoqueSaidasCacheAdmin.map(s => `
        <tr>
            <td>${s.data || "—"}</td>
            <td>${s.produtoDescricao}</td>
            <td>${s.loteNome}</td>
            <td>${formatarPeso(s.quantidade)}</td>
            <td>R$ ${formatarMoeda(s.valorTotal)}</td>
            <td>${s.criadoPor || "—"}</td>
        </tr>
    `).join("");
}

// ========================================
// ALMOXARIFADO — CUSTO POR LOTE
// ========================================
async function mostrarCustoPorLote() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaCustoLote");
    if (!token || !corpo) return;

    await carregarEstoqueSaidasAdmin();

    // agrega compra/venda por nome de lote a partir das pesagens já sincronizadas
    // (a variável "relatorios" é global, vem de app.js) e soma as saídas de estoque
    // de cada lote — sem mexer nos registros originais de pesagem.
    let porLote = {};
    function grupoDoLote(nome) {
        if (!porLote[nome]) porLote[nome] = { comprados: 0, vendidos: 0, custoCompra: 0, custoInsumos: 0 };
        return porLote[nome];
    }

    relatorios.forEach(r => {
        let nomeLote = r.descricao || "Sem descrição";
        let grupo = grupoDoLote(nomeLote);
        let d = calcularDadosCompletos(r);
        if ((r.tipo || "venda") === "compra") {
            grupo.comprados += d.totalAnimais;
            grupo.custoCompra += d.totalRS;
        } else {
            grupo.vendidos += d.totalAnimais;
        }
    });

    estoqueSaidasCacheAdmin.forEach(s => {
        let grupo = grupoDoLote(s.loteNome);
        grupo.custoInsumos += s.valorTotal;
    });

    let nomesLotes = Object.keys(porLote).sort();
    if (nomesLotes.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6">Nenhum dado de lote disponível ainda.</td></tr>`;
        return;
    }

    corpo.innerHTML = nomesLotes.map(nome => {
        let g = porLote[nome];
        let headcount = g.comprados - g.vendidos;
        let custoTotal = g.custoCompra + g.custoInsumos;
        let custoMedio = headcount > 0 ? custoTotal / headcount : 0;
        return `
            <tr>
                <td>${nome}</td>
                <td>${headcount}</td>
                <td>R$ ${formatarMoeda(g.custoCompra)}</td>
                <td>R$ ${formatarMoeda(g.custoInsumos)}</td>
                <td>R$ ${formatarMoeda(custoTotal)}</td>
                <td>${headcount > 0 ? "R$ " + formatarMoeda(custoMedio) : "—"}</td>
            </tr>
        `;
    }).join("");
}
