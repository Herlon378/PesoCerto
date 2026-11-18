// ========================================
// CLIENTES (app do curral e gerenciamento)
// ========================================
// Cadastro de clientes (vendedores/compradores) com até 3 contas para
// receber pagamento, e o que usa esse cadastro:
// - Nova Pesagem: os nomes aparecem como sugestão (só o nome, pra todos).
// - Relatório (imprimir, PDF, WhatsApp): pergunta se inclui os dados
//   bancários do cliente; escolhida a conta, a folha sai com os dados, o
//   valor total e, se a conta tiver PIX, um QR Code do PIX com o valor.
// Permissão (gestão de usuários): "nenhum" | "ver" | "editar"; admin = tudo.
// O servidor confere a mesma permissão em cada rota (ver /api/clientes).
// O relatório acha o cliente pelo NOME do vendedor/comprador -- as pesagens
// não guardam o cliente, e a sincronização das pesagens não muda nada.
(function () {
    const MAX_CONTAS = 3;
    const BANCOS = [
        ["001", "Banco do Brasil"], ["003", "Banco da Amazônia"], ["004", "Banco do Nordeste"], ["021", "Banestes"],
        ["033", "Santander"], ["037", "Banpará"], ["041", "Banrisul"], ["047", "Banese"], ["070", "BRB"],
        ["077", "Banco Inter"], ["084", "Uniprime"], ["085", "Ailos"], ["097", "Credisis"], ["104", "Caixa Econômica Federal"],
        ["133", "Cresol"], ["136", "Unicred"], ["197", "Stone"], ["208", "BTG Pactual"], ["212", "Banco Original"],
        ["237", "Bradesco"], ["260", "Nubank"], ["290", "PagBank"], ["323", "Mercado Pago"], ["336", "C6 Bank"],
        ["341", "Itaú"], ["380", "PicPay"], ["389", "Banco Mercantil"], ["403", "Cora"], ["422", "Safra"],
        ["633", "Banco Rendimento"], ["655", "Banco BV"], ["707", "Daycoval"], ["735", "Neon"], ["748", "Sicredi"], ["756", "Sicoob"]
    ];
    const TIPOS_PIX = { cpf: "CPF", cnpj: "CNPJ", telefone: "Telefone", email: "E-mail", aleatoria: "Chave aleatória" };
    const SVG = {
        pessoas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
        mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
        busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>',
        banco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10h18L12 4 3 10z"></path><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"></path></svg>',
        pix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 21 12 12 21 3 12z"></path><path d="m8 12 4-4 4 4-4 4z"></path></svg>',
        fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>',
        lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"></path></svg>',
        ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg>',
        tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"></path></svg>',
        local: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
    };

    // ---------- utilidades ----------
    const dig = v => String(v || "").replace(/\D/g, "");
    const esc = t => String(t === undefined || t === null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const semAcento = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
    const chaveNome = t => semAcento(t).toLowerCase().replace(/\s+/g, " ").trim();
    const moeda = v => (typeof formatarMoeda === "function" ? formatarMoeda(v) : Number(v || 0).toFixed(2).replace(".", ","));

    function cpfValido(c) {
        c = dig(c);
        if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
        for (let t = 9; t < 11; t++) {
            let soma = 0;
            for (let i = 0; i < t; i++) soma += Number(c[i]) * (t + 1 - i);
            if (((soma * 10) % 11) % 10 !== Number(c[t])) return false;
        }
        return true;
    }
    function cnpjValido(c) {
        c = dig(c);
        if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
        let calc = n => {
            let soma = 0, peso = n - 7;
            for (let i = 0; i < n; i++) { soma += Number(c[i]) * peso--; if (peso < 2) peso = 9; }
            let r = soma % 11;
            return r < 2 ? 0 : 11 - r;
        };
        return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
    }
    const documentoValido = d => { d = dig(d); return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false; };
    function formatarDocumento(d) {
        d = dig(d);
        if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        return d;
    }
    function mascaraDocumento(v) {
        let d = dig(v).slice(0, 14);
        if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
        return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
    function formatarTelefone(t) {
        t = dig(t);
        if (t.length > 11 && t.startsWith("55")) t = t.slice(2);
        if (t.length === 11) return t.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        if (t.length === 10) return t.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
        return t;
    }
    function mascaraTelefone(v) {
        let d = dig(v).slice(0, 11);
        if (d.length <= 2) return d.length ? "(" + d : "";
        if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
        if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
        return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    const mascaraCep = v => { let d = dig(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; };
    const nomeBanco = codigo => (BANCOS.find(b => b[0] === dig(codigo).padStart(3, "0")) || [])[1] || "";
    const textoTipoConta = t => t === "poupanca" ? "Poupança" : "Corrente";
    // CPF no meio da lista: só um pedaço, o completo fica no cadastro
    function documentoParcial(d) {
        d = dig(d);
        if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
        if (d.length === 14) return formatarDocumento(d);
        return "";
    }
    function textoChavePix(tipo, chave) {
        if (tipo === "cpf" || tipo === "cnpj") return formatarDocumento(chave);
        if (tipo === "telefone") return formatarTelefone(chave);
        return chave;
    }

    // ---------- permissão e dados guardados no aparelho ----------
    function permClientes() {
        if (typeof obterPapelLogado === "function" && obterPapelLogado() === "admin") return "editar";
        let p = localStorage.getItem("permClientes");
        return p === "ver" || p === "editar" ? p : "nenhum";
    }
    const podeVer = () => permClientes() !== "nenhum";
    const podeEditar = () => permClientes() === "editar";
    function lerJson(chave) { try { return JSON.parse(localStorage.getItem(chave) || "[]") || []; } catch (e) { return []; } }
    // lista completa (com CPF e contas) só fica no aparelho de quem tem permissão
    const clientesCompletos = () => podeVer() ? lerJson("clientesCache") : [];
    function nomesClientes() {
        let nomes = lerJson("clientesNomes");
        return nomes.length ? nomes : clientesCompletos().map(c => ({ id: c.id, nome: c.nome }));
    }
    function guardarCompletos(lista) {
        localStorage.setItem("clientesCache", JSON.stringify(lista));
        localStorage.setItem("clientesNomes", JSON.stringify(lista.map(c => ({ id: c.id, nome: c.nome }))));
    }
    const acharPorNome = nome => { let k = chaveNome(nome); return k ? clientesCompletos().find(c => chaveNome(c.nome) === k) || null : null; };

    async function api(rota, metodo, corpo) {
        let resp = await fetch(API_URL + rota, {
            method: metodo || "GET",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + obterToken() },
            body: corpo ? JSON.stringify(corpo) : undefined
        });
        let json = await resp.json().catch(() => ({}));
        if (!resp.ok) { let e = new Error(json.erro || "Erro " + resp.status); e.status = resp.status; throw e; }
        return json;
    }

    // chamado pela sincronização: nunca derruba o resto (só leitura)
    window.sincronizarClientes = async function () {
        if (typeof obterToken !== "function" || !obterToken()) return;
        try {
            if (podeVer()) {
                try {
                    guardarCompletos(await api("/api/clientes"));
                } catch (e) {
                    if (e.status === 403) { localStorage.setItem("permClientes", "nenhum"); localStorage.removeItem("clientesCache"); }
                    else throw e;
                }
            }
            if (!podeVer()) {
                localStorage.removeItem("clientesCache");
                localStorage.setItem("clientesNomes", JSON.stringify(await api("/api/clientes/nomes")));
            }
        } catch (e) { return; }
        atualizarSugestoesNomes();
        aplicarPermissaoMenuClientes();
        let tela = document.getElementById("telaClientes");
        if (tela && tela.classList.contains("ativa") && !document.getElementById("modalCliente")) desenharLista();
    };
    window.limparDadosClientes = function () {
        ["clientesCache", "clientesNomes", "permClientes"].forEach(k => localStorage.removeItem(k));
    };

    // ---------- menu: aparece só pra quem pode ----------
    function aplicarPermissaoMenuClientes() {
        let logado = typeof obterToken === "function" && !!obterToken();
        let mostrar = logado && podeVer();
        document.querySelectorAll("#btnMenuClientes, .navDesktop [data-tela='telaClientes'], #btnPagarRelatorio").forEach(b => { b.style.display = mostrar ? "" : "none"; });
        // celular: número ímpar de cartões no menu -> o último ocupa a linha inteira
        let grade = document.querySelector("#telaMenu .menuGrade2x2");
        if (grade) {
            let visiveis = [...grade.children].filter(c => c.style.display !== "none");
            [...grade.children].forEach(c => c.classList.remove("cardMenuLargo"));
            if (visiveis.length % 2 === 1) visiveis[visiveis.length - 1].classList.add("cardMenuLargo");
        }
    }
    window.aplicarPermissaoMenuClientes = aplicarPermissaoMenuClientes;

    // ---------- Nova Pesagem: nome do cliente cadastrado ----------
    function atualizarSugestoesNomes() {
        if (typeof preencherSugestoesNomes === "function") preencherSugestoesNomes();
        mostrarSeloCliente();
    }
    // nomes dos clientes cadastrados entram primeiro na lista de sugestões
    window.nomesClientesParaSugestao = () => nomesClientes().map(c => c.nome);
    function mostrarSeloCliente() {
        let campo = document.getElementById("nomeVendedor");
        if (!campo) return;
        let selo = document.getElementById("npSeloCliente");
        if (!selo) {
            selo = document.createElement("p");
            selo.id = "npSeloCliente";
            selo.className = "npSeloCliente";
            let card = document.getElementById("cardNomeVendedor");
            if (card) card.appendChild(selo);
        }
        let k = chaveNome(campo.value);
        let cadastrado = k && nomesClientes().some(c => chaveNome(c.nome) === k);
        if (!cadastrado) { selo.hidden = true; return; }
        let cliente = acharPorNome(campo.value);
        let contas = cliente ? (cliente.contas || []).length : 0;
        selo.hidden = false;
        selo.innerHTML = `${SVG.ok}<span>Cliente cadastrado${cliente ? (contas ? ` · ${contas} conta${contas > 1 ? "s" : ""} para pagamento` : " · sem conta para pagamento") : ""}</span>`;
    }
    document.addEventListener("input", e => { if (e.target && e.target.id === "nomeVendedor") mostrarSeloCliente(); });
    document.addEventListener("change", e => { if (e.target && e.target.id === "nomeVendedor") mostrarSeloCliente(); });

    // ---------- PIX: "copia e cola" do Banco Central (BR Code) ----------
    function campoPix(id, valor) { return id + String(valor.length).padStart(2, "0") + valor; }
    function crc16(texto) {
        let crc = 0xFFFF;
        for (let i = 0; i < texto.length; i++) {
            crc ^= texto.charCodeAt(i) << 8;
            for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
        }
        return crc.toString(16).toUpperCase().padStart(4, "0");
    }
    const textoPix = (t, max) => semAcento(t).replace(/[^A-Za-z0-9 .\-]/g, "").replace(/\s+/g, " ").trim().slice(0, max).trim();
    function montarPixCopiaECola({ chave, nome, cidade, valor, descricao }) {
        let conta = campoPix("00", "br.gov.bcb.pix") + campoPix("01", chave);
        let desc = textoPix(descricao || "", 40);
        if (desc && conta.length + desc.length + 4 <= 99) conta += campoPix("02", desc);
        let corpo = campoPix("00", "01") + campoPix("26", conta) + campoPix("52", "0000") + campoPix("53", "986");
        if (valor > 0) corpo += campoPix("54", (Math.round(valor * 100) / 100).toFixed(2));
        corpo += campoPix("58", "BR") + campoPix("59", textoPix(nome, 25) || "RECEBEDOR") + campoPix("60", textoPix(cidade, 15) || "BRASIL");
        corpo += campoPix("62", campoPix("05", "***")) + "6304";
        return corpo + crc16(corpo);
    }
    window.montarPixCopiaECola = montarPixCopiaECola;

    // QR Code: usa o leitor de código de barras que o app já tem (ZXing),
    // carregado só quando precisa (no gerenciamento ele não vem na página)
    let carregandoZxing = null;
    function carregarZxing() {
        if (window.ZXingBrowser && window.ZXingBrowser.BrowserQRCodeSvgWriter) return Promise.resolve();
        if (!carregandoZxing) carregandoZxing = new Promise((ok, falha) => {
            let s = document.createElement("script");
            s.src = "lib/zxing-browser.min.js";
            s.onload = ok;
            s.onerror = () => { carregandoZxing = null; falha(new Error("Não deu pra carregar o gerador de QR Code.")); };
            document.head.appendChild(s);
        });
        return carregandoZxing;
    }
    // quadradinhos do QR (em unidades do próprio QR): serve pra folha e pro PDF
    function matrizQr(texto) {
        let svg = new window.ZXingBrowser.BrowserQRCodeSvgWriter().write(texto, 0, 0);
        let rects = [...svg.querySelectorAll("rect")].map(r => ["x", "y", "width", "height"].map(a => Number(r.getAttribute(a)) || 0));
        let menorX = Math.min(...rects.map(r => r[0])), menorY = Math.min(...rects.map(r => r[1]));
        let modulo = Math.min(...rects.map(r => r[2]).filter(w => w > 0));
        let tamanho = Math.max(...rects.map(r => r[0] + r[2])) - menorX;
        return { modulos: Math.round(tamanho / modulo), quadrados: rects.map(r => [(r[0] - menorX) / modulo, (r[1] - menorY) / modulo, r[2] / modulo, r[3] / modulo]) };
    }
    function svgDoQr(m, px) {
        let margem = 4, total = m.modulos + margem * 2; // borda branca de 4 quadradinhos, como pede o padrão do QR
        return `<svg class="folhaPixQr" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="QR Code do PIX"><rect width="${total}" height="${total}" fill="#fff"/>${m.quadrados.map(q => `<rect x="${q[0] + margem}" y="${q[1] + margem}" width="${q[2]}" height="${q[3]}" fill="#000"/>`).join("")}</svg>`;
    }

    // ---------- pagamento escolhido para um relatório ----------
    function totalDosRegistros(registros) {
        return (registros || []).reduce((s, r) => s + (typeof calcularDadosCompletos === "function" ? calcularDadosCompletos(r).totalRS : 0), 0);
    }
    async function montarPagamento(cliente, conta, registros) {
        let valor = Math.round(totalDosRegistros(registros) * 100) / 100;
        let pag = { cliente, conta, valor, copiaECola: null, qr: null };
        if (conta.pixChave) {
            let r = registros[0] || {};
            pag.copiaECola = montarPixCopiaECola({ chave: conta.pixChave, nome: conta.titular || cliente.nome, cidade: cliente.cidade, valor, descricao: r.numero ? "Pesagem " + r.numero : "" });
            try { await carregarZxing(); pag.qr = matrizQr(pag.copiaECola); } catch (e) { pag.qr = null; }
        }
        return pag;
    }

    // Antes de imprimir / PDF / WhatsApp: "Incluir dados bancários do cliente?"
    // Devolve o pagamento escolhido, null (sem dados) ou "cancelar".
    // opcoes.direto (botão Pagar): pula a pergunta "incluir?" e vai direto
    // pra escolha da conta; Voltar/fechar cancelam
    window.perguntarDadosPagamento = function (registros, opcoes) {
        let direto = !!(opcoes && opcoes.direto);
        let comConta = clientesCompletos().filter(c => (c.contas || []).length);
        if (!podeVer() || !comConta.length || !registros || !registros.length) return Promise.resolve(null);
        let r = registros[0];
        // numa VENDA quem recebe é a fazenda, não o comprador: não sugere a
        // conta do comprador, a pessoa escolhe o cadastro de quem recebe
        let ehVenda = (r.tipo || "venda") === "venda";
        let achado = ehVenda ? null : acharPorNome(r.vendedor);
        let valor = totalDosRegistros(registros);
        prepararEstilo();
        return new Promise(resolver => {
            let modal = document.createElement("div");
            modal.id = "modalPagamentoCliente";
            modal.className = "modal cliModal";
            modal.style.display = "flex";
            document.body.appendChild(modal);
            let clienteAtual = achado && (achado.contas || []).length ? achado : null;
            let contaId = null;
            let terminar = res => { modal.remove(); resolver(res); };
            function topo(titulo, sub) {
                return `<div class="cliModalTopo"><span class="cliIcone">${SVG.banco}</span><div><b>${titulo}</b><small>${sub}</small></div>
                    <button type="button" class="btn-nao cliFechar" data-acao="cancelar" aria-label="Cancelar">${SVG.fechar}</button></div>`;
            }
            function passoPergunta() {
                let quem = esc(r.vendedor || "sem nome");
                let info = ehVenda
                    ? `<p class="cliTexto">Numa venda, quem recebe o pagamento é a fazenda. Se incluir, escolha na lista o cadastro de quem vai receber (por exemplo, a própria fazenda cadastrada como cliente).</p>`
                    : clienteAtual
                    ?`<p class="cliTexto"><b>${esc(clienteAtual.nome)}</b> está cadastrado com ${clienteAtual.contas.length} conta${clienteAtual.contas.length > 1 ? "s" : ""} para pagamento.</p>`
                    : `<p class="cliTexto">${achado ? `<b>${quem}</b> está cadastrado, mas não tem conta para pagamento.` : `<b>${quem}</b> não está nos clientes cadastrados.`} Se incluir, você escolhe o cliente na lista.</p>`;
                modal.innerHTML = `<div class="cliModalCaixa">${topo("Incluir dados bancários do cliente?", "Saem na folha junto com o valor a pagar")}
                    ${info}
                    <div class="cliValorTotal"><span>Valor total do relatório</span><b>R$ ${moeda(valor)}</b></div>
                    <div class="cliAcoes"><button type="button" class="cliBotaoSec" data-acao="nao">Não incluir</button>
                    <button type="button" class="cliBotaoPri" data-acao="sim">Sim, incluir</button></div></div>`;
            }
            function passoCliente(filtro) {
                let k = chaveNome(filtro || "");
                let lista = comConta.filter(c => !k || chaveNome(c.nome).includes(k) || dig(c.documento).includes(dig(filtro) || "#"));
                modal.innerHTML = `<div class="cliModalCaixa">${topo("Qual cliente vai receber?", "Só aparecem clientes com conta para pagamento")}
                    <label class="cliBusca">${SVG.busca}<input type="search" id="cliBuscaPagamento" placeholder="Buscar pelo nome ou CPF" value="${esc(filtro || "")}" autocomplete="off"></label>
                    <div class="cliEscolhas">${lista.map(c => `<button type="button" class="cliEscolha" data-cliente="${c.id}"><b>${esc(c.nome)}</b><small>${c.contas.length} conta${c.contas.length > 1 ? "s" : ""}${c.cidade ? " · " + esc(c.cidade) : ""}</small></button>`).join("") || `<p class="cliVazio">Nenhum cliente encontrado.</p>`}</div>
                    <div class="cliAcoes"><button type="button" class="cliBotaoSec" data-acao="${direto ? "cancelar" : "voltarPergunta"}">${direto ? "Cancelar" : "Voltar"}</button></div></div>`;
                let busca = modal.querySelector("#cliBuscaPagamento");
                busca.oninput = () => { let pos = busca.selectionStart; passoCliente(busca.value); let b = modal.querySelector("#cliBuscaPagamento"); b.focus(); try { b.setSelectionRange(pos, pos); } catch (e) {} };
            }
            function passoConta() {
                let contas = clienteAtual.contas;
                // pra pagar, a conta com PIX vem marcada (é a que gera o código)
                if (!contaId || !contas.some(c => c.id === contaId)) contaId = ((direto && contas.find(c => c.pixChave)) || contas[0]).id;
                modal.innerHTML = `<div class="cliModalCaixa">${topo("Conta para recebimento", esc(clienteAtual.nome))}
                    <div class="cliEscolhas">${contas.map(c => `<button type="button" class="cliConta${c.id === contaId ? " cliContaAtiva" : ""}" data-conta="${c.id}" aria-pressed="${c.id === contaId}">
                        <span class="cliRadio"></span><span class="cliContaTextos">${linhasConta(c)}</span></button>`).join("")}</div>
                    <div class="cliValorTotal"><span>Valor a pagar</span><b>R$ ${moeda(valor)}</b></div>
                    <div class="cliAcoes"><button type="button" class="cliBotaoSec" data-acao="trocarCliente">Outro cliente</button>
                    <button type="button" class="cliBotaoPri" data-acao="confirmar">${direto ? "Pagar nesta conta" : "Usar esta conta"}</button></div></div>`;
            }
            modal.addEventListener("click", async e => {
                let b = e.target.closest("[data-acao], [data-cliente], [data-conta]");
                if (!b) return;
                if (b.dataset.cliente) { clienteAtual = comConta.find(c => c.id === b.dataset.cliente); contaId = null; passoConta(); return; }
                if (b.dataset.conta) { contaId = b.dataset.conta; passoConta(); return; }
                let acao = b.dataset.acao;
                if (acao === "cancelar") terminar("cancelar");
                else if (acao === "nao") terminar(null);
                else if (acao === "sim") clienteAtual ? passoConta() : passoCliente("");
                else if (acao === "voltarPergunta") passoPergunta();
                else if (acao === "trocarCliente") passoCliente("");
                else if (acao === "confirmar") {
                    b.disabled = true;
                    let conta = clienteAtual.contas.find(c => c.id === contaId);
                    terminar(await montarPagamento(clienteAtual, conta, registros));
                }
            });
            if (direto) clienteAtual ? passoConta() : passoCliente("");
            else passoPergunta();
        });
    };

    // ---------- botão "Pagar" (Relatórios do celular) ----------
    // Compra selecionada -> escolhe a conta do vendedor -> copia o PIX copia e
    // cola já com o valor e abre o compartilhar do celular pra escolher o app
    // do banco. Conta sem PIX: mostra os dados bancários pra transferência.
    function copiarTexto(texto) {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto).then(() => true, () => copiarAntigo(texto));
        return Promise.resolve(copiarAntigo(texto));
    }
    function copiarAntigo(texto) {
        try {
            let campo = document.createElement("textarea");
            campo.value = texto; campo.setAttribute("readonly", ""); campo.style.cssText = "position:fixed;top:-1000px;opacity:0";
            document.body.appendChild(campo); campo.select();
            let ok = document.execCommand("copy"); campo.remove(); return ok;
        } catch (e) { return false; }
    }
    window.pagarRelatorioSelecionado = async function () {
        let sel = document.querySelector("input[name='relatorioSelecionado']:checked");
        let r = sel && typeof relatorios !== "undefined" ? relatorios[Number(sel.value)] : null;
        if (!r) { alert("Selecione na lista a compra que você vai pagar."); return; }
        if ((r.tipo || "venda") !== "compra") { alert("\u201cPagar\u201d é para compras. Numa venda quem recebe o pagamento é a fazenda."); return; }
        if (!podeVer()) { alert("Para pagar pelo app você precisa de acesso aos Clientes (dados bancários). Peça ao administrador."); return; }
        if (!clientesCompletos().some(c => (c.contas || []).length)) { alert("Nenhum cliente com conta para pagamento. Cadastre o vendedor em Clientes, com uma chave PIX."); return; }
        let registros = typeof obterRegistrosDaSessao === "function" ? obterRegistrosDaSessao(r) : [r];
        let pag = await window.perguntarDadosPagamento(registros, { direto: true });
        if (!pag || pag === "cancelar") return;
        abrirPagamento(pag, r);
    };
    function abrirPagamento(p, r) {
        prepararEstilo();
        let modal = document.createElement("div");
        modal.id = "modalPagarPix";
        modal.className = "modal cliModal";
        modal.style.display = "flex";
        let c = p.conta;
        let podeCompartilhar = !!navigator.share;
        let dadosBanco = linhasDadosPagamento(p).map(([rot, v]) => rot + ": " + v).join("\n") + "\nValor: R$ " + moeda(p.valor);
        let corpo = p.copiaECola ? `
            ${p.qr ? `<div class="cliPixQr">${svgDoQr(p.qr, 210)}</div>` : ""}
            <p class="cliPixPassos"><b>No app do banco:</b> Pix \u2192 <b>Pix Copia e Cola</b> \u2192 colar o código. O valor já vem preenchido.</p>
            <code class="cliPixCodigo">${esc(p.copiaECola)}</code>
            <p class="cliPixStatus" id="cliPixStatus" aria-live="polite"></p>
            <div class="cliAcoes cliAcoesPix">
                <button type="button" class="cliBotaoSec" data-acao="copiar">Copiar código</button>
                ${podeCompartilhar ? `<button type="button" class="cliBotaoPri" data-acao="compartilhar">${SVG.pix}Abrir app do banco</button>` : ""}
            </div>` : `
            <p class="cliTexto">Esta conta não tem chave PIX: o pagamento vai por transferência com os dados abaixo.</p>
            <div class="cliPixDados">${linhasDadosPagamento(p).map(([rot, v]) => `<div><span>${esc(rot)}</span><b>${esc(v)}</b></div>`).join("")}</div>
            <p class="cliPixStatus" id="cliPixStatus" aria-live="polite"></p>
            <div class="cliAcoes cliAcoesPix">
                <button type="button" class="cliBotaoSec" data-acao="copiarDados">Copiar dados</button>
                ${podeCompartilhar ? `<button type="button" class="cliBotaoPri" data-acao="compartilharDados">Compartilhar</button>` : ""}
            </div>`;
        modal.innerHTML = `<div class="cliModalCaixa">
            <div class="cliModalTopo"><span class="cliIcone">${SVG.pix}</span><div><b>Pagar compra${r.numero ? " nº " + r.numero : ""}</b><small>${esc(c.titular)}${c.pixChave ? " · PIX " + esc(TIPOS_PIX[c.pixTipo] || "") : ""}</small></div>
                <button type="button" class="btn-nao cliFechar" data-acao="fechar" aria-label="Fechar">${SVG.fechar}</button></div>
            <div class="cliValorTotal"><span>Valor a pagar</span><b>R$ ${moeda(p.valor)}</b></div>
            ${corpo}
        </div>`;
        document.body.appendChild(modal);
        let status = texto => { let el = modal.querySelector("#cliPixStatus"); if (el) el.textContent = texto; };
        // já abre com o código copiado (o toque em "Pagar nesta conta" libera a área de transferência)
        if (p.copiaECola) copiarTexto(p.copiaECola).then(ok => status(ok ? "Código PIX copiado. Abra o app do banco e cole em Pix Copia e Cola." : "Toque em Copiar código."));
        modal.addEventListener("click", async e => {
            let b = e.target.closest("[data-acao]");
            if (!b) return;
            let acao = b.dataset.acao;
            if (acao === "fechar") modal.remove();
            else if (acao === "copiar") status((await copiarTexto(p.copiaECola)) ? "Código PIX copiado." : "Não deu pra copiar: segure o dedo no código e copie.");
            else if (acao === "copiarDados") status((await copiarTexto(dadosBanco)) ? "Dados bancários copiados." : "Não deu pra copiar.");
            else if (acao === "compartilhar" || acao === "compartilharDados") {
                let texto = acao === "compartilhar" ? p.copiaECola : dadosBanco;
                await copiarTexto(texto);
                try { await navigator.share({ title: "PIX " + c.titular + " · R$ " + moeda(p.valor), text: texto }); }
                catch (err) { if (err && err.name !== "AbortError") status("Código copiado. Abra o app do banco e cole em Pix Copia e Cola."); }
            }
        });
    }

    function linhasConta(c) {
        let linhas = [`<b>${esc(c.titular)}</b>`];
        if (c.bancoCodigo) linhas.push(`<small>${SVG.banco}${esc(c.bancoCodigo)} - ${esc(c.bancoNome || nomeBanco(c.bancoCodigo))} · Ag. ${esc(c.agencia)} · ${textoTipoConta(c.tipoConta)} ${esc(c.conta)}</small>`);
        if (c.pixChave) linhas.push(`<small>${SVG.pix}PIX (${TIPOS_PIX[c.pixTipo] || "chave"}): ${esc(textoChavePix(c.pixTipo, c.pixChave))}</small>`);
        return linhas.join("");
    }

    // ---------- o pagamento dentro do relatório ----------
    function linhasDadosPagamento(p) {
        let c = p.conta, l = [];
        l.push(["Favorecido", c.titular]);
        if (c.documento) l.push(["CPF/CNPJ", formatarDocumento(c.documento)]);
        if (c.bancoCodigo) {
            l.push(["Banco", `${c.bancoCodigo} - ${c.bancoNome || nomeBanco(c.bancoCodigo)}`]);
            l.push(["Agência", c.agencia]);
            l.push([`Conta ${textoTipoConta(c.tipoConta).toLowerCase()}`, c.conta]);
        }
        if (c.pixChave) l.push([`Chave PIX (${TIPOS_PIX[c.pixTipo] || "chave"})`, textoChavePix(c.pixTipo, c.pixChave)]);
        return l;
    }
    window.htmlPagamentoFolha = function (p) {
        if (!p || !p.conta) return "";
        let dados = linhasDadosPagamento(p).map(([r, v]) => `<div><span>${esc(r)}</span><b>${esc(v)}</b></div>`).join("");
        let qr = p.qr ? `<div class="folhaPixQrCaixa">${svgDoQr(p.qr, 150)}<small>Aponte a câmera do app do banco</small></div>` : "";
        return `<section class="folhaPagamento">
            <h2>Dados para pagamento</h2>
            <div class="folhaPagamentoCorpo">
                <div class="folhaPagamentoDados">${dados}
                    <div class="folhaPagamentoValor"><span>Valor a pagar</span><b>R$ ${moeda(p.valor)}</b></div>
                </div>${qr}
            </div>
            ${p.copiaECola ? `<div class="folhaPixCopia"><span>PIX copia e cola</span><code>${esc(p.copiaECola)}</code></div>` : ""}
        </section>`;
    };
    window.textoPagamentoWhatsApp = function (p) {
        if (!p || !p.conta) return [];
        let l = ["", "━━━━━━━━━━━━━━━", "💳 *DADOS PARA PAGAMENTO*"];
        linhasDadosPagamento(p).forEach(([r, v]) => l.push(`*${r}:* ${v}`));
        l.push(`*Valor a pagar:* R$ ${moeda(p.valor)}`);
        if (p.copiaECola) { l.push("", "*PIX copia e cola:*", p.copiaECola); }
        return l;
    };
    // desenha no PDF (jsPDF, mm) a partir de y; devolve o novo y
    window.desenharPagamentoPdf = function (pdf, p, y, L, R, garantir) {
        if (!p || !p.conta) return y;
        let dados = linhasDadosPagamento(p);
        let comQr = !!p.qr, tamQr = 40;
        let alturaTexto = 12 + dados.length * 6 + 12;
        let altura = Math.max(alturaTexto, comQr ? tamQr + 14 : 0) + (p.copiaECola ? 14 : 0);
        y = garantir(altura + 4);
        pdf.setDrawColor(43, 90, 163); pdf.setLineWidth(0.5);
        pdf.roundedRect(L, y, R - L, altura, 2, 2, "S");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5); pdf.setTextColor(43, 90, 163);
        pdf.text("DADOS PARA PAGAMENTO", L + 4, y + 7);
        let yy = y + 14, xValor = L + 4, larguraTexto = (R - L) - (comQr ? tamQr + 16 : 8);
        dados.forEach(([r, v]) => {
            pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(107, 114, 128);
            pdf.text(r, xValor, yy);
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(29, 36, 51);
            pdf.text(String(v), xValor + 44, yy, { maxWidth: larguraTexto - 44 });
            yy += 6;
        });
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52);
        pdf.text("Valor a pagar: R$ " + moeda(p.valor), xValor, yy + 4);
        if (comQr) {
            let x0 = R - 6 - tamQr, y0 = y + 8, total = p.qr.modulos, m = tamQr / total;
            pdf.setFillColor(0, 0, 0);
            p.qr.quadrados.forEach(q => pdf.rect(x0 + q[0] * m, y0 + q[1] * m, q[2] * m, q[3] * m, "F"));
            pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(107, 114, 128);
            pdf.text("PIX com o valor", x0 + tamQr / 2, y0 + tamQr + 4, { align: "center" });
        }
        if (p.copiaECola) {
            pdf.setFont("courier", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(55, 65, 81);
            pdf.text(pdf.splitTextToSize("PIX copia e cola: " + p.copiaECola, (R - L) - 8).slice(0, 3), L + 4, y + altura - 10);
        }
        return y + altura + 4;
    };

    // ---------- tela Clientes ----------
    let filtroLista = "";
    window.abrirTelaClientes = function () {
        prepararEstilo();
        if (typeof trocarTela === "function") trocarTela("telaClientes");
        desenharLista();
        if (typeof sincronizarClientes === "function" && navigator.onLine) sincronizarClientes();
    };
    function desenharLista() {
        let el = document.getElementById("clientesConteudo");
        if (!el) return;
        if (!podeVer()) { el.innerHTML = `<p class="cliVazio">Você não tem acesso aos clientes. Peça ao administrador.</p>`; return; }
        let todos = clientesCompletos();
        let k = chaveNome(filtroLista), d = dig(filtroLista);
        let lista = todos.filter(c => !k || chaveNome(c.nome).includes(k) || (d && (dig(c.documento).includes(d) || dig(c.telefone).includes(d))) || chaveNome(c.cidade).includes(k));
        let comConta = todos.filter(c => (c.contas || []).length).length;
        el.innerHTML = `
            <div class="cliCabecalho">
                <div><h2>Clientes</h2><small>${todos.length} cadastrado${todos.length === 1 ? "" : "s"} · ${comConta} com conta para pagamento</small></div>
                ${podeEditar() ? `<button type="button" class="cliBotaoPri cliNovo" data-acao="novo">${SVG.mais}Novo cliente</button>` : ""}
            </div>
            <label class="cliBusca">${SVG.busca}<input type="search" id="cliBuscaLista" placeholder="Buscar por nome, CPF, telefone ou cidade" value="${esc(filtroLista)}" autocomplete="off"></label>
            <div class="cliLista">${lista.map(cartaoCliente).join("") || `<p class="cliVazio">${todos.length ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda." + (podeEditar() ? " Toque em Novo cliente para começar." : "")}</p>`}</div>`;
        let busca = el.querySelector("#cliBuscaLista");
        busca.oninput = () => { filtroLista = busca.value; let pos = busca.selectionStart; desenharLista(); let b = document.getElementById("cliBuscaLista"); b.focus(); try { b.setSelectionRange(pos, pos); } catch (e) {} };
        if (!el.dataset.cliPronto) {
            el.dataset.cliPronto = "1";
            el.addEventListener("click", e => {
                let b = e.target.closest("[data-acao], [data-cliente]");
                if (!b || e.target.closest("a")) return;
                if (b.dataset.acao === "novo") abrirFormulario(null);
                else if (b.dataset.cliente) abrirFormulario(clientesCompletos().find(c => c.id === b.dataset.cliente));
            });
        }
    }
    function iniciais(nome) { let p = String(nome || "").trim().split(/\s+/); return ((p[0] || "")[0] || "").toUpperCase() + ((p.length > 1 ? p[p.length - 1][0] : "") || "").toUpperCase(); }
    function cartaoCliente(c) {
        let contas = c.contas || [];
        let local = [c.cidade, c.uf].filter(Boolean).join(" - ");
        return `<button type="button" class="cliCartao" data-cliente="${c.id}">
            <span class="cliAvatar">${esc(iniciais(c.nome))}</span>
            <span class="cliCartaoTextos">
                <b>${esc(c.nome)}</b>
                <small>${[documentoParcial(c.documento), c.telefone ? formatarTelefone(c.telefone) : "", local].filter(Boolean).map(esc).join(" · ") || "Sem documento"}</small>
                <span class="cliChips">${contas.map(k => `<span class="cliChip">${k.bancoCodigo ? esc(k.bancoNome || nomeBanco(k.bancoCodigo)) : "PIX"}${k.bancoCodigo && k.pixChave ? " + PIX" : ""}</span>`).join("") || `<span class="cliChip cliChipVazio">Sem conta para pagamento</span>`}</span>
            </span>
        </button>`;
    }

    // ---------- formulário (novo / editar / só ver) ----------
    function abrirFormulario(cliente) {
        prepararEstilo();
        let somenteVer = !podeEditar();
        let c = cliente ? JSON.parse(JSON.stringify(cliente)) : { nome: "", documento: "", telefone: "", endereco: "", bairro: "", cidade: "", uf: "", cep: "", observacao: "", contas: [] };
        let modal = document.createElement("div");
        modal.id = "modalCliente";
        modal.className = "modal cliModal cliModalForm";
        modal.style.display = "flex";
        let campo = (id, rotulo, valor, extra) => `<label class="cliCampo${extra && extra.largo ? " cliLargo" : ""}"><span>${rotulo}</span><input id="${id}" value="${esc(valor || "")}" ${extra && extra.attrs || ""} ${somenteVer ? "readonly" : ""}></label>`;
        modal.innerHTML = `<div class="cliModalCaixa cliFormCaixa">
            <div class="cliModalTopo"><span class="cliIcone">${SVG.pessoas}</span><div><b>${cliente ? (somenteVer ? "Cliente" : "Editar cliente") : "Novo cliente"}</b><small>${somenteVer ? "Somente consulta" : "Os campos com * são obrigatórios"}</small></div>
                <button type="button" class="btn-nao cliFechar" data-acao="fechar" aria-label="Fechar">${SVG.fechar}</button></div>
            <div class="cliFormRolagem">
                <h3>Dados do cliente</h3>
                <div class="cliGrade">
                    ${campo("cliNome", "Nome completo *", c.nome, { largo: true, attrs: 'autocapitalize="words" maxlength="120" autocomplete="off"' })}
                    ${campo("cliDocumento", "CPF ou CNPJ", c.documento ? formatarDocumento(c.documento) : "", { attrs: 'inputmode="numeric" autocomplete="off"' })}
                    ${campo("cliTelefone", "Telefone / WhatsApp", c.telefone ? formatarTelefone(c.telefone) : "", { attrs: 'inputmode="tel" autocomplete="off"' })}
                </div>
                <h3>Endereço</h3>
                <div class="cliGrade">
                    ${campo("cliEndereco", "Rua / fazenda e número", c.endereco, { largo: true, attrs: 'maxlength="160"' })}
                    ${campo("cliBairro", "Bairro / região", c.bairro, { attrs: 'maxlength="80"' })}
                    ${campo("cliCep", "CEP", c.cep ? mascaraCep(c.cep) : "", { attrs: 'inputmode="numeric"' })}
                    ${campo("cliCidade", "Cidade", c.cidade, { attrs: 'maxlength="80" autocapitalize="words"' })}
                    ${campo("cliUf", "UF", c.uf, { attrs: 'maxlength="2" autocapitalize="characters"' })}
                </div>
                <h3>Contas para pagamento <small>até ${MAX_CONTAS}</small></h3>
                <div id="cliContas"></div>
                ${somenteVer ? "" : `<button type="button" class="cliAdicionarConta" data-acao="addConta">${SVG.mais}Adicionar conta</button>`}
                <label class="cliCampo cliLargo"><span>Observação</span><textarea id="cliObs" maxlength="300" rows="2" ${somenteVer ? "readonly" : ""}>${esc(c.observacao || "")}</textarea></label>
                <p class="cliErro" id="cliErro" hidden></p>
            </div>
            <div class="cliAcoes cliAcoesForm">
                ${cliente && !somenteVer ? `<button type="button" class="cliBotaoPerigo" data-acao="excluir">${SVG.lixo}Excluir</button>` : ""}
                <button type="button" class="cliBotaoSec" data-acao="fechar">${somenteVer ? "Fechar" : "Cancelar"}</button>
                ${somenteVer ? "" : `<button type="button" class="cliBotaoPri" data-acao="salvar">Salvar</button>`}
            </div>
        </div>
        <datalist id="cliListaBancos">${BANCOS.map(b => `<option value="${b[1]}">${b[0]}</option>`).join("")}</datalist>`;
        document.body.appendChild(modal);

        let contas = (c.contas || []).map(k => Object.assign({}, k));
        function htmlConta(k, i) {
            let ro = somenteVer ? "readonly" : "", dis = somenteVer ? "disabled" : "";
            return `<div class="cliContaForm" data-indice="${i}">
                <div class="cliContaTitulo"><b>Conta ${i + 1}</b>${somenteVer ? "" : `<button type="button" class="cliRemover" data-acao="removerConta" data-indice="${i}">${SVG.lixo}Remover</button>`}</div>
                <div class="cliGrade">
                    <label class="cliCampo cliLargo"><span>Nome completo do titular *</span><input data-k="titular" value="${esc(k.titular)}" maxlength="120" autocapitalize="words" ${ro}></label>
                    <label class="cliCampo"><span>CPF/CNPJ do titular</span><input data-k="documento" value="${esc(k.documento ? formatarDocumento(k.documento) : "")}" inputmode="numeric" ${ro}></label>
                    <label class="cliCampo cliCurto"><span>Nº do banco</span><input data-k="bancoCodigo" value="${esc(k.bancoCodigo)}" inputmode="numeric" maxlength="3" placeholder="001" ${ro}></label>
                    <label class="cliCampo"><span>Nome do banco</span><input data-k="bancoNome" value="${esc(k.bancoNome)}" list="cliListaBancos" placeholder="Digite para buscar" ${ro}></label>
                    <label class="cliCampo cliCurto"><span>Agência</span><input data-k="agencia" value="${esc(k.agencia)}" inputmode="numeric" maxlength="10" ${ro}></label>
                    <div class="cliCampo"><span>Tipo de conta</span><div class="cliSegmentos">
                        <button type="button" data-tipo="corrente" class="${k.tipoConta !== "poupanca" ? "cliSegAtivo" : ""}" ${dis}>Corrente</button>
                        <button type="button" data-tipo="poupanca" class="${k.tipoConta === "poupanca" ? "cliSegAtivo" : ""}" ${dis}>Poupança</button></div></div>
                    <label class="cliCampo"><span>Conta (com dígito)</span><input data-k="conta" value="${esc(k.conta)}" maxlength="20" placeholder="12345-6" ${ro}></label>
                    <label class="cliCampo"><span>Tipo de chave PIX</span><select data-k="pixTipo" ${dis}>
                        <option value="">Sem PIX</option>${Object.entries(TIPOS_PIX).map(([v, t]) => `<option value="${v}" ${k.pixTipo === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
                    <label class="cliCampo cliLargo"><span>Chave PIX</span><input data-k="pixChave" value="${esc(k.pixChave ? textoChavePix(k.pixTipo, k.pixChave) : "")}" ${k.pixTipo ? "" : "disabled"} ${ro} autocomplete="off"></label>
                    ${somenteVer ? "" : `<button type="button" class="cliUsarDoc" data-acao="usarDoc" data-indice="${i}" ${k.pixTipo === "cpf" || k.pixTipo === "cnpj" ? "" : "hidden"}>Usar o CPF/CNPJ do titular como chave</button>`}
                </div></div>`;
        }
        function desenharContas() {
            let caixa = modal.querySelector("#cliContas");
            caixa.innerHTML = contas.map(htmlConta).join("") || `<p class="cliVazio">Nenhuma conta cadastrada.</p>`;
            let add = modal.querySelector("[data-acao='addConta']");
            if (add) add.hidden = contas.length >= MAX_CONTAS;
        }
        // guarda o que foi digitado nas contas antes de redesenhar
        function lerContas() {
            modal.querySelectorAll(".cliContaForm").forEach(box => {
                let k = contas[Number(box.dataset.indice)];
                box.querySelectorAll("[data-k]").forEach(inp => { k[inp.dataset.k] = inp.value.trim(); });
                k.documento = dig(k.documento); k.bancoCodigo = dig(k.bancoCodigo);
                let seg = box.querySelector(".cliSegAtivo"); k.tipoConta = seg ? seg.dataset.tipo : "corrente";
            });
        }
        desenharContas();

        const fechar = () => modal.remove();
        const erro = msg => { let e = modal.querySelector("#cliErro"); e.textContent = msg; e.hidden = !msg; if (msg) e.scrollIntoView({ block: "nearest" }); };
        modal.addEventListener("input", e => {
            let t = e.target;
            if (t.id === "cliDocumento" || t.dataset.k === "documento") t.value = mascaraDocumento(t.value);
            else if (t.id === "cliTelefone") t.value = mascaraTelefone(t.value);
            else if (t.id === "cliCep") t.value = mascaraCep(t.value);
            else if (t.id === "cliUf") t.value = t.value.toUpperCase().replace(/[^A-Z]/g, "");
            else if (t.dataset.k === "bancoCodigo") {
                t.value = dig(t.value).slice(0, 3);
                let nome = t.value.length === 3 ? nomeBanco(t.value) : "";
                if (nome) t.closest(".cliContaForm").querySelector("[data-k='bancoNome']").value = nome;
            } else if (t.dataset.k === "bancoNome") {
                let b = BANCOS.find(x => chaveNome(x[1]) === chaveNome(t.value));
                if (b) t.closest(".cliContaForm").querySelector("[data-k='bancoCodigo']").value = b[0];
            } else if (t.dataset.k === "pixChave") {
                let tipo = t.closest(".cliContaForm").querySelector("[data-k='pixTipo']").value;
                if (tipo === "cpf" || tipo === "cnpj") t.value = mascaraDocumento(t.value);
                else if (tipo === "telefone") t.value = mascaraTelefone(t.value);
            }
        });
        modal.addEventListener("change", e => {
            let t = e.target;
            if (t.dataset.k !== "pixTipo") return;
            let box = t.closest(".cliContaForm"), chave = box.querySelector("[data-k='pixChave']");
            chave.disabled = !t.value;
            if (!t.value) chave.value = "";
            chave.placeholder = { cpf: "000.000.000-00", cnpj: "00.000.000/0000-00", telefone: "(00) 00000-0000", email: "nome@email.com", aleatoria: "cole a chave aleatória" }[t.value] || "";
            chave.setAttribute("inputmode", t.value === "cpf" || t.value === "cnpj" || t.value === "telefone" ? "numeric" : t.value === "email" ? "email" : "text");
            let usar = box.querySelector(".cliUsarDoc");
            if (usar) usar.hidden = !(t.value === "cpf" || t.value === "cnpj");
        });
        modal.addEventListener("click", async e => {
            let seg = e.target.closest(".cliSegmentos button");
            if (seg && !somenteVer) { seg.parentElement.querySelectorAll("button").forEach(b => b.classList.toggle("cliSegAtivo", b === seg)); return; }
            let b = e.target.closest("[data-acao]");
            if (!b) return;
            let acao = b.dataset.acao;
            if (acao === "fechar") fechar();
            else if (acao === "addConta") {
                lerContas();
                if (contas.length >= MAX_CONTAS) return;
                // titular já vem com o nome e o CPF do cliente (o caso comum)
                contas.push({ titular: modal.querySelector("#cliNome").value.trim(), documento: dig(modal.querySelector("#cliDocumento").value), tipoConta: "corrente" });
                desenharContas();
                let novas = modal.querySelectorAll(".cliContaForm");
                novas[novas.length - 1].scrollIntoView({ behavior: "smooth", block: "start" });
            } else if (acao === "removerConta") {
                lerContas();
                if (!confirm(`Remover a conta ${Number(b.dataset.indice) + 1}?`)) return;
                contas.splice(Number(b.dataset.indice), 1);
                desenharContas();
            } else if (acao === "usarDoc") {
                let box = b.closest(".cliContaForm");
                let doc = box.querySelector("[data-k='documento']").value || modal.querySelector("#cliDocumento").value;
                box.querySelector("[data-k='pixChave']").value = mascaraDocumento(doc);
            } else if (acao === "excluir") {
                if (!confirm(`Excluir o cliente "${cliente.nome}"? As pesagens dele continuam salvas.`)) return;
                try {
                    await api("/api/clientes/" + cliente.id, "DELETE");
                    guardarCompletos(clientesCompletos().filter(x => x.id !== cliente.id));
                    fechar(); desenharLista(); atualizarSugestoesNomes();
                } catch (err) { erro(navigator.onLine ? err.message : "Sem internet: excluir precisa de conexão."); }
            } else if (acao === "salvar") {
                lerContas();
                let dados = {
                    id: cliente ? cliente.id : (crypto.randomUUID ? crypto.randomUUID() : undefined),
                    nome: modal.querySelector("#cliNome").value.trim(),
                    documento: dig(modal.querySelector("#cliDocumento").value),
                    telefone: dig(modal.querySelector("#cliTelefone").value),
                    endereco: modal.querySelector("#cliEndereco").value.trim(),
                    bairro: modal.querySelector("#cliBairro").value.trim(),
                    cidade: modal.querySelector("#cliCidade").value.trim(),
                    uf: modal.querySelector("#cliUf").value.trim(),
                    cep: dig(modal.querySelector("#cliCep").value),
                    observacao: modal.querySelector("#cliObs").value.trim(),
                    contas
                };
                let problema = validarNoAparelho(dados);
                if (problema) { erro(problema); return; }
                if (!navigator.onLine) { erro("Sem internet: o cadastro de clientes precisa de conexão para salvar."); return; }
                b.disabled = true; b.textContent = "Salvando…";
                try {
                    let salvo = await api(cliente ? "/api/clientes/" + cliente.id : "/api/clientes", cliente ? "PUT" : "POST", dados);
                    let lista = clientesCompletos().filter(x => x.id !== salvo.id).concat(salvo).sort((a, b2) => a.nome.localeCompare(b2.nome, "pt-BR"));
                    guardarCompletos(lista);
                    fechar(); desenharLista(); atualizarSugestoesNomes();
                    if (typeof avisoRapidoTela === "function") avisoRapidoTela("Cliente salvo.");
                } catch (err) {
                    erro(err.message); b.disabled = false; b.textContent = "Salvar";
                }
            }
        });
        if (!cliente && !somenteVer) setTimeout(() => modal.querySelector("#cliNome").focus(), 50);
    }

    // mesmas regras do servidor, pra avisar na hora (o servidor confere de novo)
    function validarNoAparelho(d) {
        if (!d.nome) return "Informe o nome completo do cliente.";
        if (d.documento && !documentoValido(d.documento)) return "CPF/CNPJ do cliente inválido. Confira os números.";
        if (d.telefone && d.telefone.length < 10) return "Telefone incompleto: informe o DDD e o número.";
        for (let i = 0; i < d.contas.length; i++) {
            let k = d.contas[i], n = `Conta ${i + 1}: `;
            if (!k.titular) return n + "informe o nome completo do titular.";
            if (k.documento && !documentoValido(k.documento)) return n + "CPF/CNPJ do titular inválido.";
            let temBanco = k.bancoCodigo || k.agencia || k.conta;
            if (temBanco && (!k.bancoCodigo || !k.agencia || !k.conta)) return n + "preencha banco, agência e conta (ou deixe os três em branco e use só o PIX).";
            if (!temBanco && !k.pixChave) return n + "informe os dados do banco ou uma chave PIX.";
            if (k.pixTipo && !k.pixChave) return n + "digite a chave PIX (ou escolha Sem PIX).";
            if (k.pixChave) {
                let d2 = dig(k.pixChave);
                if (k.pixTipo === "cpf" && !cpfValido(d2)) return n + "chave PIX de CPF inválida.";
                if (k.pixTipo === "cnpj" && !cnpjValido(d2)) return n + "chave PIX de CNPJ inválida.";
                if (k.pixTipo === "telefone" && (d2.length < 10 || d2.length > 13)) return n + "chave PIX de telefone inválida (use DDD + número).";
                if (k.pixTipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k.pixChave)) return n + "chave PIX de e-mail inválida.";
                if (k.pixTipo === "aleatoria" && !/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(k.pixChave)) return n + "chave PIX aleatória inválida.";
            }
        }
        return null;
    }

    // ---------- visual ----------
    let estiloPronto = false;
    function prepararEstilo() {
        if (estiloPronto) return;
        estiloPronto = true;
        let s = document.createElement("style");
        s.textContent = `
        .cliModal [hidden] { display: none !important; }
        .cliPixQr { display: flex; justify-content: center; margin-top: 14px; }
        .cliPixQr svg { border-radius: 10px; }
        .cliPixPassos { margin: 12px 0 0; font-size: 14px; line-height: 1.45; color: #c9d3e6; }
        .cliPixPassos b { color: #fff; }
        .cliPixCodigo { display: block; margin-top: 10px; padding: 10px 12px; max-height: 92px; overflow-y: auto; border-radius: 10px; font-size: 12px; line-height: 1.4; word-break: break-all; color: #a5f3fc; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); user-select: all; -webkit-user-select: all; }
        .cliPixStatus { min-height: 18px; margin: 8px 0 0; font-size: 13.5px; font-weight: 600; color: #4ade80; }
        .cliPixDados { display: grid; gap: 8px; margin-top: 12px; }
        .cliPixDados div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.04); }
        .cliPixDados span { font-size: 13px; color: #a6b0c6; }
        .cliPixDados b { font-size: 14px; color: #fff; text-align: right; overflow-wrap: anywhere; }
        .cliAcoesPix button svg { width: 18px; height: 18px; }
        .cliModal { position: fixed; inset: 0; z-index: 990; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(2,6,16,0.66); }
        .cliModalCaixa { width: min(100%, 520px); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; box-sizing: border-box; padding: 18px; border-radius: 18px; color: #e5edf8; text-align: left;
            background: #111a2b; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 24px 60px rgba(0,0,0,0.55); font-family: inherit; }
        .cliFormCaixa { width: min(100%, 720px); padding: 0; }
        .cliModalTopo { display: flex; align-items: center; gap: 12px; }
        .cliFormCaixa .cliModalTopo { padding: 16px 18px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .cliModalTopo > div { flex: 1; min-width: 0; }
        .cliModalTopo b { display: block; font-size: 17px; color: #fff; }
        .cliModalTopo small { display: block; margin-top: 2px; font-size: 12.5px; color: #a6b0c6; }
        .cliIcone { width: 42px; height: 42px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 13px; color: #22d3ee; background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.35); }
        .cliIcone svg { width: 22px; height: 22px; }
        .cliModal .cliFechar.btn-nao { flex: 0 0 auto; width: 40px; height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #c9d3e6; }
        .cliFechar svg { width: 18px; height: 18px; }
        .cliTexto { margin: 14px 0 0; font-size: 15px; line-height: 1.45; color: #c9d3e6; }
        .cliTexto b { color: #fff; }
        .cliValorTotal { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.35); }
        .cliValorTotal span { font-size: 13px; color: #a7f3d0; }
        .cliValorTotal b { font-size: 20px; color: #4ade80; font-variant-numeric: tabular-nums; }
        .cliAcoes { display: flex; gap: 10px; margin-top: 16px; }
        .cliAcoesForm { margin: 0; padding: 14px 18px; border-top: 1px solid rgba(255,255,255,0.08); }
        .cliAcoes button { flex: 1; min-height: 50px; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
        .cliAcoes button svg { width: 18px; height: 18px; }
        .cliBotaoPri { color: #fff; background: #16a34a; border: none; }
        .cliBotaoPri:disabled { opacity: 0.6; }
        .cliBotaoSec { color: #e5edf8; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.14); }
        .cliBotaoPerigo { flex: 0 0 auto !important; padding: 0 16px; color: #fca5a5; background: transparent; border: 1px solid rgba(248,113,113,0.5); }
        .cliBusca { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 0 14px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #8ea0bd; }
        .cliBusca svg { width: 18px; height: 18px; flex-shrink: 0; }
        .cliBusca input { flex: 1; min-width: 0; height: 100%; margin: 0; padding: 0; border: none; background: transparent; color: #fff; font: inherit; font-size: 15px; outline: none; box-shadow: none; }
        .cliEscolhas { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; overflow-y: auto; min-height: 0; }
        .cliEscolha, .cliConta { display: flex; align-items: flex-start; gap: 12px; width: 100%; margin: 0; padding: 12px 14px; border-radius: 12px; text-align: left; cursor: pointer; font: inherit; color: #e5edf8; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); }
        .cliEscolha { flex-direction: column; gap: 2px; }
        .cliEscolha b, .cliContaTextos b { font-size: 15px; color: #fff; }
        .cliEscolha small { font-size: 12.5px; color: #a6b0c6; }
        .cliContaAtiva { border-color: #22c55e; background: rgba(34,197,94,0.1); }
        .cliRadio { width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px; border-radius: 50%; border: 2px solid #64748b; box-sizing: border-box; }
        .cliContaAtiva .cliRadio { border: 6px solid #22c55e; }
        .cliContaTextos { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .cliContaTextos small { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #c9d3e6; overflow-wrap: anywhere; }
        .cliContaTextos small svg { width: 15px; height: 15px; flex-shrink: 0; color: #22d3ee; }
        .cliVazio { margin: 14px 0; text-align: center; font-size: 14px; color: #8ea0bd; }
        .cliFormRolagem { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 18px 16px; -webkit-overflow-scrolling: touch; }
        .cliFormRolagem h3 { display: flex; align-items: baseline; gap: 8px; margin: 18px 0 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: #22d3ee; }
        .cliFormRolagem h3 small { font-size: 11px; color: #8ea0bd; letter-spacing: 0; text-transform: none; }
        .cliGrade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .cliCampo { display: flex; flex-direction: column; gap: 5px; min-width: 0; margin: 0; }
        .cliLargo { grid-column: 1 / -1; }
        .cliCampo > span { font-size: 12.5px; font-weight: 600; color: #a6b0c6; }
        .cliCampo input, .cliCampo select, .cliCampo textarea { width: 100%; box-sizing: border-box; margin: 0; min-height: 46px; padding: 10px 12px; border-radius: 10px; font: inherit; font-size: 16px; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); }
        .cliCampo select option { color: #111; }
        .cliCampo input:disabled { opacity: 0.45; }
        .cliCampo input:focus, .cliCampo select:focus, .cliCampo textarea:focus { outline: 2px solid #22d3ee; outline-offset: 0; border-color: transparent; }
        .cliSegmentos { display: flex; gap: 6px; }
        .cliSegmentos button { flex: 1; min-height: 46px; margin: 0; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; color: #c9d3e6; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); }
        .cliSegmentos .cliSegAtivo { color: #062b33; background: #22d3ee; border-color: #22d3ee; }
        .cliContaForm { margin-top: 10px; padding: 12px; border-radius: 14px; background: rgba(34,211,238,0.04); border: 1px solid rgba(34,211,238,0.22); }
        .cliContaTitulo { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .cliContaTitulo b { font-size: 15px; color: #fff; }
        .cliRemover, .cliUsarDoc { display: inline-flex; align-items: center; gap: 6px; margin: 0; padding: 6px 10px; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; color: #fca5a5; background: transparent; border: 1px solid rgba(248,113,113,0.4); }
        .cliRemover svg { width: 15px; height: 15px; }
        .cliUsarDoc { grid-column: 1 / -1; justify-self: start; color: #67e8f9; border-color: rgba(34,211,238,0.4); }
        .cliAdicionarConta { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin: 10px 0 0; min-height: 48px; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; color: #67e8f9; background: transparent; border: 1.5px dashed rgba(34,211,238,0.5); }
        .cliAdicionarConta svg { width: 18px; height: 18px; }
        .cliErro { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 14px; color: #fecaca; background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.4); }
        #clientesConteudo { padding: 4px 16px 24px; box-sizing: border-box; max-width: 980px; }
        /* celular: fundo escuro e cabeçalho travado, só a lista rola (mesmo padrão das outras telas) */
        body:not(.modoDesktop) #telaClientes { background: var(--navy-900, #0b1220); color: var(--ink, #e5edf8); }
        body:not(.modoDesktop) #clientesConteudo { flex: 1 1 0; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; width: 100%; }
        body:not(.modoDesktop) .cliCabecalho h2 { display: none; }
        .cliCabecalho { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .cliCabecalho h2 { margin: 0; font-size: 24px; color: #fff; }
        .cliCabecalho small { display: block; margin-top: 2px; font-size: 13px; color: #a6b0c6; }
        .cliNovo { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 18px; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
        .cliNovo svg { width: 18px; height: 18px; }
        .cliLista { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 10px; margin-top: 14px; }
        .cliCartao { display: flex; align-items: flex-start; gap: 12px; width: 100%; margin: 0; padding: 14px; border-radius: 16px; text-align: left; cursor: pointer; font: inherit; color: #e5edf8; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); }
        .cliCartao:active { transform: scale(0.99); }
        .cliAvatar { width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 800; color: #062b33; background: #22d3ee; }
        .cliCartaoTextos { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .cliCartaoTextos b { font-size: 16px; color: #fff; overflow-wrap: anywhere; }
        .cliCartaoTextos small { font-size: 13px; color: #a6b0c6; overflow-wrap: anywhere; }
        .cliChips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
        .cliChip { padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #a5f3fc; background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.3); }
        .cliChipVazio { color: #a6b0c6; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
        .npSeloCliente { display: flex; align-items: center; gap: 6px; margin: 6px 2px 0; font-size: 13px; font-weight: 600; color: #4ade80; }
        .npSeloCliente svg { width: 15px; height: 15px; flex-shrink: 0; }
        .npSeloCliente[hidden] { display: none; }
        .cardMenuLargo { grid-column: 1 / -1; min-height: 0 !important; }
        .cardMenuCiano { border-bottom-color: #0891b2; background: linear-gradient(160deg, rgba(8,145,178,0.12), var(--surface, #161f30) 55%); }
        .cardMenuCiano .cardMenuIcone { background: rgba(34,211,238,0.16); color: #67e8f9; }
        @media (max-width: 560px) {
            .cliModal { padding: 0; align-items: stretch; }
            .cliModalCaixa { width: 100%; max-height: 100dvh; border-radius: 0; }
            .cliModal:not(.cliModalForm) .cliModalCaixa { margin-top: auto; border-radius: 20px 20px 0 0; max-height: 92dvh; }
            .cliGrade { grid-template-columns: minmax(0, 1fr); }
            .cliGrade .cliCurto { grid-column: auto; }
            .cliContaForm .cliGrade { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .cliContaForm .cliCampo:not(.cliCurto) { grid-column: 1 / -1; }
        }
        /* folha impressa: dados para pagamento */
        .folhaPagamento { margin-top: 18px; padding: 14px 16px; border: 2px solid #2b5aa3; border-radius: 10px; break-inside: avoid; page-break-inside: avoid; }
        .folhaPagamento h2 { margin: 0 0 10px; font-size: 15px; letter-spacing: 1px; text-transform: uppercase; color: #2b5aa3 !important; }
        .folhaPagamentoCorpo { display: flex; gap: 18px; align-items: flex-start; }
        .folhaPagamentoDados { flex: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; min-width: 0; }
        .folhaPagamentoDados div { display: flex; flex-direction: column; min-width: 0; }
        .folhaPagamentoDados span { font-size: 10.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #6b7280 !important; }
        .folhaPagamentoDados b { font-size: 14px; overflow-wrap: anywhere; }
        .folhaPagamentoValor { grid-column: 1 / -1; padding-top: 8px; border-top: 1px dashed #cbd5e1; }
        .folhaPagamentoValor b { font-size: 20px; color: #166534 !important; }
        .folhaPixQrCaixa { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
        .folhaPixQrCaixa small { font-size: 10.5px; color: #6b7280 !important; }
        .folhaPixCopia { margin-top: 10px; }
        .folhaPixCopia span { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #6b7280 !important; }
        .folhaPixCopia code { display: block; margin-top: 3px; font-size: 10px; line-height: 1.35; word-break: break-all; color: #374151 !important; }
        @media (max-width: 600px) { .folhaPagamentoCorpo { flex-direction: column; align-items: stretch; } .folhaPixQrCaixa { align-self: center; } .folhaPagamentoDados { grid-template-columns: minmax(0, 1fr); } }
        `;
        document.head.appendChild(s);
    }
    prepararEstilo();
    // menu certo assim que a página abre (login restaurado)
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplicarPermissaoMenuClientes);
    else aplicarPermissaoMenuClientes();
})();
