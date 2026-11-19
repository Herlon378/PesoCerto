// ========================================
// ASSINATURAS (gerenciamento, só o dono do sistema)
// ========================================
// Fase 1 da cobrança: planos (o dono cria e define os valores; começam em
// R$ 0) e a assinatura de cada fazenda -- plano, valor próprio, desconto,
// grátis (sempre ou até uma data), cobranças extras, dados de cobrança,
// observações e a linha do tempo com tudo o que mudou. Nada é cobrado nem
// bloqueado aqui; o bloqueio continua no painel Fazendas.
(function () {
    const SITUACOES = { teste: "Em teste", ativa: "Ativa", suspensa: "Suspensa", cancelada: "Cancelada" };
    const esc = t => String(t === undefined || t === null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const rs = v => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dataBR = d => d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—";
    const quando = d => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
    const setas = t => esc(t).replace(/ -&gt; /g, " → ");
    let estado = { aba: "clientes", filtro: "todos", busca: "", lista: [], planos: [] };

    async function api(rota, metodo, corpo) {
        let resp = await fetch(API_URL + rota, { method: metodo || "GET", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + obterToken() }, body: corpo ? JSON.stringify(corpo) : undefined });
        let json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json.erro || "Erro " + resp.status);
        return json;
    }

    window.abrirTelaAssinaturas = async function () {
        prepararEstilo();
        if (typeof trocarTela === "function") trocarTela("telaAssinaturas");
        let el = document.getElementById("assConteudo");
        if (!el) return;
        if (!estado.lista.length) el.innerHTML = `<p class="assVazio">Carregando…</p>`;
        try {
            [estado.lista, estado.planos] = await Promise.all([api("/api/sistema/assinaturas"), api("/api/sistema/planos")]);
            desenhar();
        } catch (e) { el.innerHTML = `<p class="assVazio">Não deu para carregar: ${esc(e.message)}</p>`; }
    };

    function classeSituacao(a) {
        if (a.bloqueada) return ["Bloqueada", "assPillVermelho"];
        if (a.valor.motivoGratis === "isento") return ["Grátis", "assPillAzul"];
        if (a.valor.motivoGratis === "gratis_ate") return ["Grátis até " + dataBR(a.valor.gratisAte), "assPillAzul"];
        if (a.situacao === "teste") return ["Em teste", "assPillAzul"];
        if (a.situacao === "suspensa") return ["Suspensa", "assPillAmbar"];
        if (a.situacao === "cancelada") return ["Cancelada", "assPillCinza"];
        return ["Ativa", "assPillVerde"];
    }
    function passaFiltro(a) {
        let f = estado.filtro;
        if (f === "pagando" && !(a.valor.aPagar > 0)) return false;
        if (f === "gratis" && !(a.valor.motivoGratis === "isento" || a.valor.motivoGratis === "gratis_ate" || (a.valor.cheio === 0 && a.situacao === "ativa"))) return false;
        if (f === "teste" && a.situacao !== "teste") return false;
        if (f === "inativas" && !(a.situacao === "suspensa" || a.situacao === "cancelada" || a.bloqueada)) return false;
        let k = estado.busca.trim().toLowerCase();
        if (k && !(a.nome.toLowerCase().includes(k) || String(a.responsavel || "").toLowerCase().includes(k))) return false;
        return true;
    }

    function desenhar() {
        let el = document.getElementById("assConteudo");
        let L = estado.lista;
        let pagantes = L.filter(a => a.valor.aPagar > 0);
        let receita = pagantes.reduce((s, a) => s + a.valor.aPagar, 0);
        let cheio = L.filter(a => !a.principal && a.situacao !== "cancelada").reduce((s, a) => s + a.valor.cheio, 0);
        let gratis = L.filter(a => !a.principal && (a.valor.motivoGratis === "isento" || a.valor.motivoGratis === "gratis_ate"));
        let extras = L.reduce((s, a) => s + (a.valor.aPagar > 0 ? a.valor.totalExtras : 0), 0);
        el.innerHTML = `
            <div class="assCabecalho"><div><h2>Assinaturas</h2><small>${L.length} fazenda${L.length === 1 ? "" : "s"} · nada é cobrado ainda: aqui você organiza planos e valores de cada cliente</small></div></div>
            <div class="assKpis">
                <div class="assKpi"><span>Receita mensal prevista</span><b>${rs(receita)}</b><small>${pagantes.length} pagante${pagantes.length === 1 ? "" : "s"}</small></div>
                <div class="assKpi"><span>Se todos pagassem</span><b>${rs(cheio)}</b><small>valor cheio, sem os grátis</small></div>
                <div class="assKpi"><span>Liberadas grátis</span><b>${gratis.length}</b><small>isentas ou grátis até uma data</small></div>
                <div class="assKpi"><span>Extras no mês</span><b>${rs(extras)}</b><small>assistência, treinamento…</small></div>
            </div>
            <div class="assAbas" role="tablist">
                <button type="button" role="tab" data-aba="clientes" class="${estado.aba === "clientes" ? "assAbaAtiva" : ""}">Clientes</button>
                <button type="button" role="tab" data-aba="planos" class="${estado.aba === "planos" ? "assAbaAtiva" : ""}">Planos (${estado.planos.length})</button>
            </div>
            <div id="assAba"></div>`;
        estado.aba === "planos" ? desenharPlanos() : desenharClientes();
        if (!el.dataset.pronto) {
            el.dataset.pronto = "1";
            el.addEventListener("click", e => {
                let b = e.target.closest("[data-aba], [data-filtro], [data-fazenda], [data-plano], [data-acao]");
                if (!b) return;
                if (b.dataset.aba) { estado.aba = b.dataset.aba; desenhar(); }
                else if (b.dataset.filtro) { estado.filtro = b.dataset.filtro; desenharClientes(); }
                else if (b.dataset.fazenda) abrirFicha(b.dataset.fazenda);
                else if (b.dataset.plano) abrirPlano(estado.planos.find(p => p.id === b.dataset.plano));
                else if (b.dataset.acao === "novoPlano") abrirPlano(null);
            });
            el.addEventListener("input", e => { if (e.target.id === "assBusca") { estado.busca = e.target.value; desenharLista(); } });
        }
    }

    function desenharClientes() {
        let filtros = [["todos", "Todos"], ["pagando", "Pagando"], ["gratis", "Grátis"], ["teste", "Em teste"], ["inativas", "Suspensas / canceladas"]];
        document.getElementById("assAba").innerHTML = `
            <div class="assFiltros">
                <input id="assBusca" class="assBusca" type="search" placeholder="Buscar fazenda ou responsável" value="${esc(estado.busca)}" autocomplete="off">
                <div class="assChips">${filtros.map(([k, t]) => `<button type="button" data-filtro="${k}" class="${estado.filtro === k ? "assChipAtivo" : ""}">${t}</button>`).join("")}</div>
            </div>
            <div class="assLista" id="assLista"></div>`;
        desenharLista();
    }
    function desenharLista() {
        let lista = estado.lista.filter(passaFiltro);
        document.getElementById("assLista").innerHTML = lista.map(a => {
            let [sit, cls] = classeSituacao(a);
            let valor = a.valor.aPagar > 0 ? `<b class="assValor">${rs(a.valor.aPagar)}</b><small>por mês · vence dia ${a.diaVencimento}</small>`
                : `<b class="assValor assValorGratis">Grátis</b><small>${a.valor.cheio > 0 ? "valor cheio " + rs(a.valor.cheio) : "plano de R$ 0,00"}</small>`;
            let usuarios = a.limiteUsuarios ? `${a.uso.usuarios}/${a.limiteUsuarios}` : a.uso.usuarios;
            let acima = a.limiteUsuarios && a.uso.usuarios > a.limiteUsuarios;
            return `<button type="button" class="assCartao" data-fazenda="${a.fazendaId}">
                <span class="assCartaoTopo"><b>${esc(a.nome)}</b><span class="assPill ${cls}">${esc(sit)}</span></span>
                <span class="assCartaoMeio"><span class="assPlano">${esc(a.planoNome || "Sem plano")}${a.valorPersonalizado !== null ? " · valor próprio" : ""}${a.descontoPct ? " · " + a.descontoPct + "% desc." : ""}${a.extras.filter(x => x.ativo).length ? " · " + a.extras.filter(x => x.ativo).length + " extra(s)" : ""}</span><span class="assPreco">${valor}</span></span>
                <span class="assUso"><span class="${acima ? "assAcima" : ""}">${usuarios} usuário(s)</span><span>${a.uso.pesagens30} pesagens em 30 dias</span><span>último acesso ${a.uso.ultimoAcesso ? dataBR(String(a.uso.ultimoAcesso).slice(0, 10)) : "—"}</span></span>
            </button>`;
        }).join("") || `<p class="assVazio">Nenhuma fazenda nesse filtro.</p>`;
    }

    function desenharPlanos() {
        document.getElementById("assAba").innerHTML = `
            <div class="assPlanosTopo"><p>Os planos que as fazendas podem ter. Mudou o valor de um plano, todas as fazendas nele passam a ter o valor novo (menos quem tem valor próprio).</p>
            <button type="button" class="assBotaoPri" data-acao="novoPlano">Novo plano</button></div>
            <div class="assLista">${estado.planos.map(p => `<button type="button" class="assCartao${p.ativo ? "" : " assInativo"}" data-plano="${p.id}">
                <span class="assCartaoTopo"><b>${esc(p.nome)}</b>${p.ativo ? "" : `<span class="assPill assPillCinza">Desativado</span>`}</span>
                <span class="assCartaoMeio"><span class="assPlano">${esc(p.descricao || "")}</span><span class="assPreco"><b class="assValor">${rs(p.valorMensal)}</b><small>por mês</small></span></span>
                <span class="assUso"><span>${p.limiteUsuarios ? "até " + p.limiteUsuarios + " usuários" : "usuários ilimitados"}</span><span>${p.fazendas} fazenda(s) neste plano</span></span>
            </button>`).join("")}</div>`;
    }

    // ---------- janela: plano ----------
    function abrirPlano(p) {
        let m = janela(`${p ? "Editar plano" : "Novo plano"}`, `
            <label class="assCampo"><span>Nome</span><input id="apNome" value="${esc(p ? p.nome : "")}" maxlength="60"></label>
            <label class="assCampo"><span>O que inclui</span><input id="apDesc" value="${esc(p ? p.descricao || "" : "")}" maxlength="300"></label>
            <div class="assGrade">
                <label class="assCampo"><span>Valor por mês (R$)</span><input id="apValor" inputmode="decimal" value="${p ? String(p.valorMensal).replace(".", ",") : "0,00"}"></label>
                <label class="assCampo"><span>Limite de usuários</span><input id="apLimite" inputmode="numeric" value="${p && p.limiteUsuarios ? p.limiteUsuarios : ""}" placeholder="vazio = ilimitado"></label>
                <label class="assCampo"><span>Ordem na lista</span><input id="apOrdem" inputmode="numeric" value="${p ? p.ordem : estado.planos.length + 1}"></label>
            </div>
            <label class="assCheck"><input type="checkbox" id="apAtivo" ${!p || p.ativo ? "checked" : ""}> Disponível para novas fazendas</label>`,
            async () => {
                let corpo = { nome: m.q("#apNome").value, descricao: m.q("#apDesc").value, valorMensal: m.q("#apValor").value.replace(/\./g, "").replace(",", "."), limiteUsuarios: m.q("#apLimite").value.trim(), ordem: m.q("#apOrdem").value, ativo: m.q("#apAtivo").checked };
                await api(p ? "/api/sistema/planos/" + p.id : "/api/sistema/planos", p ? "PUT" : "POST", corpo);
                await window.abrirTelaAssinaturas();
            });
    }

    // ---------- janela: ficha da fazenda ----------
    async function abrirFicha(id) {
        let a = estado.lista.find(x => x.fazendaId === id);
        if (!a) return;
        let planos = estado.planos.filter(p => p.ativo || p.id === a.planoId);
        let m = janela(a.nome, `
            <h3>Plano e valor</h3>
            <div class="assGrade">
                <label class="assCampo"><span>Plano</span><select id="afPlano">${planos.map(p => `<option value="${p.id}" ${p.id === a.planoId ? "selected" : ""}>${esc(p.nome)} · ${rs(p.valorMensal)}</option>`).join("")}</select></label>
                <label class="assCampo"><span>Situação</span><select id="afSituacao">${Object.entries(SITUACOES).map(([k, t]) => `<option value="${k}" ${k === a.situacao ? "selected" : ""}>${t}</option>`).join("")}</select></label>
                <label class="assCampo"><span>Valor próprio (R$)</span><input id="afValor" inputmode="decimal" value="${a.valorPersonalizado === null ? "" : String(a.valorPersonalizado).replace(".", ",")}" placeholder="vazio = valor do plano"></label>
                <label class="assCampo"><span>Desconto (%)</span><input id="afDesconto" inputmode="decimal" value="${a.descontoPct || ""}" placeholder="0"></label>
                <label class="assCampo"><span>Grátis até</span><input id="afGratisAte" type="date" value="${a.valor.gratisAte || ""}"></label>
                <label class="assCampo"><span>Dia do vencimento</span><input id="afDia" inputmode="numeric" value="${a.diaVencimento}"></label>
            </div>
            <label class="assCheck"><input type="checkbox" id="afIsento" ${a.isento ? "checked" : ""}> Liberar uso grátis (sem data para acabar)</label>
            <div class="assResumoValor" id="afResumo"></div>
            <h3>Cobranças extras</h3>
            <div id="afExtras"></div>
            <div class="assExtraNovo">
                <input id="afExtraDesc" placeholder="Ex.: Assistência extra" maxlength="100">
                <input id="afExtraValor" inputmode="decimal" placeholder="Valor">
                <select id="afExtraTipo"><option value="mes">Todo mês</option><option value="uma">Só um mês</option></select>
                <input id="afExtraMes" type="month" hidden>
                <button type="button" class="assBotaoSec" data-acao="addExtra">Adicionar</button>
            </div>
            <h3>Dados de cobrança</h3>
            <div class="assGrade">
                <label class="assCampo"><span>Responsável</span><input id="afResp" value="${esc(a.responsavel || "")}" maxlength="100"></label>
                <label class="assCampo"><span>CPF ou CNPJ</span><input id="afDoc" inputmode="numeric" value="${esc(a.documento || "")}"></label>
                <label class="assCampo"><span>Telefone / WhatsApp</span><input id="afTel" inputmode="tel" value="${esc(a.telefone || "")}"></label>
                <label class="assCampo"><span>E-mail de cobrança</span><input id="afEmail" type="email" value="${esc(a.email || "")}"></label>
            </div>
            <label class="assCampo"><span>Observações</span><textarea id="afObs" rows="2" maxlength="2000">${esc(a.observacoes || "")}</textarea></label>
            <h3>Uso</h3>
            <p class="assTextoFraco">${a.uso.usuarios} usuário(s) ativo(s)${a.limiteUsuarios ? " de " + a.limiteUsuarios + " do plano" : ""} · ${a.uso.pesagens} pesagens no total, ${a.uso.pesagens30} nos últimos 30 dias · cliente desde ${dataBR(String(a.cadastro).slice(0, 10))}</p>
            <h3>Linha do tempo</h3>
            <div class="assExtraNovo"><input id="afNota" placeholder="Escreva uma anotação (ex.: combinou pagar dia 20)" maxlength="1000"><button type="button" class="assBotaoSec" data-acao="addNota">Anotar</button></div>
            <ol class="assTempo" id="afTempo"><li class="assTextoFraco">Carregando…</li></ol>`,
            async () => {
                await api("/api/sistema/assinaturas/" + id, "PUT", {
                    planoId: m.q("#afPlano").value, situacao: m.q("#afSituacao").value,
                    valorPersonalizado: m.q("#afValor").value.trim().replace(/\./g, "").replace(",", "."),
                    descontoPct: m.q("#afDesconto").value.trim().replace(",", ".") || 0,
                    gratisAte: m.q("#afGratisAte").value, diaVencimento: Number(m.q("#afDia").value),
                    isento: m.q("#afIsento").checked, responsavel: m.q("#afResp").value, documento: m.q("#afDoc").value,
                    telefone: m.q("#afTel").value, email: m.q("#afEmail").value, observacoes: m.q("#afObs").value
                });
                await window.abrirTelaAssinaturas();
            }, true);
        // prévia do valor enquanto edita
        const previa = () => {
            let plano = estado.planos.find(p => p.id === m.q("#afPlano").value);
            let proprio = m.q("#afValor").value.trim();
            let base = proprio ? Number(proprio.replace(/\./g, "").replace(",", ".")) || 0 : (plano ? plano.valorMensal : 0);
            let desc = Number(m.q("#afDesconto").value.replace(",", ".")) || 0;
            let extras = a.extras.filter(x => x.ativo && (x.recorrente || x.mesReferencia === new Date().toISOString().slice(0, 7))).reduce((s, x) => s + x.valor, 0);
            let cheio = Math.round((base - base * desc / 100 + extras) * 100) / 100;
            let gratisAte = m.q("#afGratisAte").value;
            let gratis = m.q("#afIsento").checked ? "liberado grátis" : (gratisAte && gratisAte >= new Date().toISOString().slice(0, 10) ? "grátis até " + dataBR(gratisAte) : "");
            let sit = m.q("#afSituacao").value;
            m.q("#afResumo").innerHTML = `<span>${rs(base)}${desc ? ` − ${desc}%` : ""}${extras ? ` + extras ${rs(extras)}` : ""}</span><b>${gratis || sit === "cancelada" || sit === "suspensa" ? "Paga R$ 0,00 <small>(" + (gratis || SITUACOES[sit].toLowerCase()) + ", cheio " + rs(cheio) + ")</small>" : "Paga " + rs(cheio) + " por mês"}</b>`;
        };
        ["afPlano", "afValor", "afDesconto", "afGratisAte", "afIsento", "afSituacao"].forEach(i => m.q("#" + i).addEventListener("input", previa));
        m.q("#afIsento").addEventListener("change", previa);
        previa();
        const desenharExtras = () => {
            let ativos = a.extras.filter(x => x.ativo);
            m.q("#afExtras").innerHTML = ativos.length ? ativos.map(x => `<div class="assExtra"><span>${esc(x.descricao)} <small>${x.recorrente ? "todo mês" : "só em " + String(x.mesReferencia).split("-").reverse().join("/")}</small></span><b>${rs(x.valor)}</b><button type="button" class="assRemover" data-extra="${x.id}" aria-label="Remover">Remover</button></div>`).join("") : `<p class="assTextoFraco">Nenhuma cobrança extra.</p>`;
        };
        desenharExtras();
        const tempo = async () => {
            try {
                let ev = await api("/api/sistema/assinaturas/" + id + "/eventos");
                m.q("#afTempo").innerHTML = ev.map(e => `<li><span class="assQuando">${quando(e.quando)} · ${esc(e.quem || "")}</span><span class="assTipo${e.tipo === "anotacao" ? " assNota" : ""}">${setas(e.detalhe || e.tipo)}</span></li>`).join("") || `<li class="assTextoFraco">Nada registrado ainda.</li>`;
            } catch (e) { m.q("#afTempo").innerHTML = `<li class="assTextoFraco">${esc(e.message)}</li>`; }
        };
        tempo();
        m.q("#afExtraTipo").addEventListener("change", () => { m.q("#afExtraMes").hidden = m.q("#afExtraTipo").value !== "uma"; m.q("#afExtraMes").value = m.q("#afExtraMes").value || new Date().toISOString().slice(0, 7); });
        m.el.addEventListener("click", async e => {
            let b = e.target.closest("[data-acao='addExtra'], [data-acao='addNota'], [data-extra]");
            if (!b) return;
            try {
                if (b.dataset.extra) {
                    await api("/api/sistema/assinaturas/" + id + "/extras/" + b.dataset.extra, "DELETE");
                    a.extras = a.extras.map(x => x.id === b.dataset.extra ? Object.assign({}, x, { ativo: false }) : x);
                } else if (b.dataset.acao === "addExtra") {
                    let uma = m.q("#afExtraTipo").value === "uma";
                    let novo = await api("/api/sistema/assinaturas/" + id + "/extras", "POST", { descricao: m.q("#afExtraDesc").value, valor: m.q("#afExtraValor").value.replace(/\./g, "").replace(",", "."), recorrente: !uma, mesReferencia: uma ? m.q("#afExtraMes").value : undefined });
                    a.extras.push(novo);
                    m.q("#afExtraDesc").value = ""; m.q("#afExtraValor").value = "";
                } else {
                    await api("/api/sistema/assinaturas/" + id + "/anotacoes", "POST", { texto: m.q("#afNota").value });
                    m.q("#afNota").value = "";
                }
                m.erro("");
                desenharExtras(); previa(); tempo();
            } catch (err) { m.erro(err.message); }
        });
    }

    // janela genérica com Salvar / Cancelar
    function janela(titulo, corpo, aoSalvar, larga) {
        let el = document.createElement("div");
        el.className = "modal assModal";
        el.style.display = "flex";
        el.innerHTML = `<form class="assJanela${larga ? " assJanelaLarga" : ""}" novalidate>
            <div class="assJanelaTopo"><b>${esc(titulo)}</b><button type="button" class="btn-nao assFechar" data-fechar aria-label="Fechar">×</button></div>
            <div class="assJanelaCorpo">${corpo}</div>
            <p class="assErro" hidden></p>
            <div class="assJanelaAcoes"><button type="button" class="assBotaoSec" data-fechar>Cancelar</button><button type="submit" class="assBotaoPri">Salvar</button></div>
        </form>`;
        document.body.appendChild(el);
        const m = { el, q: s => el.querySelector(s), erro: t => { let p = el.querySelector(".assErro"); p.textContent = t; p.hidden = !t; } };
        el.addEventListener("click", e => { if (e.target.closest("[data-fechar]")) el.remove(); });
        el.querySelector("form").addEventListener("submit", async e => {
            e.preventDefault();
            let b = el.querySelector(".assJanelaAcoes .assBotaoPri");
            b.disabled = true; b.textContent = "Salvando…";
            try { await aoSalvar(); el.remove(); if (typeof avisoRapidoTela === "function") avisoRapidoTela("Salvo."); }
            catch (err) { m.erro(err.message); b.disabled = false; b.textContent = "Salvar"; }
        });
        return m;
    }

    function prepararEstilo() {
        if (document.getElementById("estiloAssinaturas")) return;
        let s = document.createElement("style");
        s.id = "estiloAssinaturas";
        s.textContent = `
        #assConteudo { max-width: 1100px; }
        #assConteudo h2 { margin: 0; }
        .assCabecalho small { display: block; margin-top: 4px; color: var(--ink-muted); }
        .assKpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-top: 16px; }
        .assKpi { padding: 14px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); }
        .assKpi span { display: block; font-size: 11.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-muted); }
        .assKpi b { display: block; margin-top: 4px; font-size: 22px; font-variant-numeric: tabular-nums; color: var(--ink); }
        .assKpi small { color: var(--ink-muted); font-size: 12px; }
        .assAbas { display: flex; gap: 6px; margin-top: 18px; border-bottom: 1px solid var(--border); }
        .assAbas button { margin: 0; padding: 9px 16px; border: none; border-bottom: 3px solid transparent; background: transparent; color: var(--ink-muted); font: inherit; font-weight: 700; cursor: pointer; }
        .assAbas .assAbaAtiva { color: var(--ink); border-bottom-color: #38bdf8; }
        .assFiltros { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 14px 0 6px; }
        .assBusca { flex: 1 1 240px; min-width: 0; margin: 0; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); font: inherit; }
        .assChips { display: flex; flex-wrap: wrap; gap: 6px; }
        .assChips button { margin: 0; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--ink-muted); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
        .assChips .assChipAtivo { color: #0b2530; background: #38bdf8; border-color: #38bdf8; }
        .assLista { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 10px; margin-top: 10px; }
        .assCartao { display: flex; flex-direction: column; gap: 8px; width: 100%; margin: 0; padding: 14px; text-align: left; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); font: inherit; cursor: pointer; }
        .assCartao:hover { border-color: #38bdf8; }
        .assInativo { opacity: 0.6; }
        .assCartaoTopo { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .assCartaoTopo b { font-size: 16px; overflow-wrap: anywhere; }
        .assCartaoMeio { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; }
        .assPlano { font-size: 13px; color: var(--ink-muted); min-width: 0; }
        .assPreco { text-align: right; flex-shrink: 0; }
        .assPreco small { display: block; font-size: 11.5px; color: var(--ink-muted); }
        .assValor { font-size: 18px; font-variant-numeric: tabular-nums; }
        .assValorGratis { color: #38bdf8; }
        .assUso { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--ink-muted); border-top: 1px dashed var(--border); padding-top: 8px; }
        .assAcima { color: #f59e0b; font-weight: 700; }
        .assPill { flex-shrink: 0; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
        .assPillVerde { color: #4ade80; background: rgba(74,222,128,0.14); }
        .assPillAzul { color: #38bdf8; background: rgba(56,189,248,0.14); }
        .assPillAmbar { color: #f59e0b; background: rgba(245,158,11,0.14); }
        .assPillVermelho { color: #f87171; background: rgba(248,113,113,0.14); }
        .assPillCinza { color: var(--ink-muted); background: var(--surface-sunken); }
        .assVazio { margin: 20px 0; color: var(--ink-muted); }
        .assPlanosTopo { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
        .assPlanosTopo p { margin: 0; max-width: 70ch; color: var(--ink-muted); font-size: 14px; }
        .assBotaoPri, .assBotaoSec { margin: 0; padding: 10px 16px; border-radius: 10px; font: inherit; font-weight: 700; cursor: pointer; }
        .assBotaoPri { color: #fff; background: #16a34a; border: none; }
        .assBotaoPri:disabled { opacity: 0.6; }
        .assBotaoSec { color: var(--ink); background: var(--surface-sunken); border: 1px solid var(--border); }
        .assModal { position: fixed; inset: 0; z-index: 990; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(2,6,16,0.6); }
        .assModal [hidden] { display: none !important; }
        .assJanela { width: min(100%, 520px); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; border-radius: 16px; background: var(--surface); color: var(--ink); border: 1px solid var(--border); box-shadow: 0 24px 60px rgba(0,0,0,0.45); }
        .assJanelaLarga { width: min(100%, 760px); }
        .assJanelaTopo { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
        .assJanelaTopo b { font-size: 17px; }
        .assModal .assFechar.btn-nao { flex: 0 0 auto; width: 36px; height: 36px; padding: 0; border-radius: 10px; font-size: 22px; line-height: 1; color: var(--ink-muted); background: var(--surface-sunken); border: 1px solid var(--border); }
        .assJanelaCorpo { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 18px 14px; }
        .assJanelaCorpo h3 { margin: 16px 0 8px; font-size: 12.5px; letter-spacing: 1px; text-transform: uppercase; color: #38bdf8; }
        .assJanelaAcoes { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--border); }
        .assGrade { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
        .assCampo { display: flex; flex-direction: column; gap: 4px; margin: 0 0 8px; min-width: 0; }
        .assCampo span { font-size: 12.5px; font-weight: 600; color: var(--ink-muted); }
        .assCampo input, .assCampo select, .assCampo textarea, .assExtraNovo input, .assExtraNovo select { width: 100%; box-sizing: border-box; margin: 0; padding: 9px 10px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface-sunken); color: var(--ink); font: inherit; }
        .assCheck { display: flex; align-items: center; gap: 8px; margin: 4px 0 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .assCheck input { width: 18px; height: 18px; margin: 0; }
        .assResumoValor { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 12px; border-radius: 10px; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.35); font-size: 13.5px; }
        .assResumoValor b { font-size: 16px; }
        .assResumoValor small { font-weight: 500; color: var(--ink-muted); }
        .assExtra { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin-bottom: 6px; border-radius: 9px; background: var(--surface-sunken); }
        .assExtra span { flex: 1; min-width: 0; }
        .assExtra small { color: var(--ink-muted); }
        .assRemover { margin: 0; padding: 5px 10px; border-radius: 8px; border: 1px solid rgba(248,113,113,0.45); background: transparent; color: #f87171; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .assExtraNovo { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
        .assExtraNovo input { flex: 1 1 140px; width: auto; }
        .assExtraNovo select { flex: 0 1 130px; width: auto; }
        .assExtraNovo button { flex: 0 0 auto; }
        .assTextoFraco { margin: 4px 0; font-size: 13.5px; color: var(--ink-muted); }
        .assTempo { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 0; }
        .assTempo li { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-bottom: 1px dashed var(--border); }
        .assQuando { font-size: 11.5px; color: var(--ink-muted); }
        .assTipo { font-size: 14px; }
        .assNota { padding: 6px 10px; border-radius: 8px; background: rgba(245,158,11,0.12); }
        .assErro { margin: 0 18px 10px; padding: 9px 12px; border-radius: 9px; font-size: 14px; color: #fecaca; background: rgba(248,113,113,0.14); border: 1px solid rgba(248,113,113,0.4); }
        @media (max-width: 560px) { .assModal { padding: 0; } .assJanela, .assJanelaLarga { width: 100%; max-height: 100dvh; border-radius: 0; } }
        `;
        document.head.appendChild(s);
    }
})();
