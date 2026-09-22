// ========================================
// BANCO DE DADOS DE SALVAMENTO DEFINITIVO
// ========================================
function salvarPesagem(){
    let vendedor = document.getElementById("nomeVendedor").value;
    let descricao = document.getElementById("descricao").value;
    let valorKg = document.getElementById("valorKg").value;
    let tipoEl = document.getElementById("tipoOperacao");
    let tipoPesagemEl = document.getElementById("tipoPesagem");
    let rendEl = document.getElementById("rendimentoArroba");

    let dados = {
        id: crypto.randomUUID(),
        vendedor: vendedor || "Geral",
        descricao: descricao || "Sem descrição",
        valorKg: valorKg || "R$ 0,00",
        tipo: tipoEl ? tipoEl.value : "venda",
        tipoPesagem: tipoPesagemEl ? tipoPesagemEl.value : "vivo",
        rendimento: rendEl ? rendEl.value : "",
        pesos: pesos,
        data: new Date().toLocaleString("pt-BR"),
        sincronizado: false,
        // presente só quando essa pesagem foi salva junto com outra(s) na
        // mesma sessão (mais de 1 critério usado de uma vez) -- deixa o
        // relatório/WhatsApp juntarem essas pesagens num recibo só, sem
        // mudar em nada como elas são tratadas em Custo por Lote/Dashboard/
        // Resultado Mensal (que nem sabem que esse campo existe)
        sessaoId: (typeof sessaoPesagemIdAtual !== "undefined" && sessaoPesagemIdAtual) ? sessaoPesagemIdAtual : null
    };

    let lista = JSON.parse(localStorage.getItem("pesagens") || "[]");
    lista.push(dados);

    localStorage.setItem("pesagens", JSON.stringify(lista));
    localStorage.removeItem("pesagemAtual");

    if(typeof sincronizarAgora === "function") {
        sincronizarAgora();
    }
}

/* salvamento automático -- guarda TODOS os critérios (não só o ativo),
   senão uma queda do app no meio de uma pesagem com Critério 2/3 abertos
   perderia os pesos já lançados nos outros critérios */
function salvarPesagemAuto(){
    let vendedor = document.getElementById("nomeVendedor").value;
    let tipoEl = document.getElementById("tipoOperacao");

    if(typeof criteriosPesagem !== "undefined" && criteriosPesagem[criterioAtivoIndex]){
        criteriosPesagem[criterioAtivoIndex].pesos = pesos;
    }

    let dados = {
        vendedor: vendedor,
        tipo: tipoEl ? tipoEl.value : "venda",
        criteriosPesagem: (typeof criteriosPesagem !== "undefined" && criteriosPesagem.length) ? criteriosPesagem : undefined,
        data: new Date()
    };

    localStorage.setItem("pesagemAtual", JSON.stringify(dados));
}

/* restaurar pesagem se fechar */
function restaurarPesagem(){
    try {
        let dados = JSON.parse(localStorage.getItem("pesagemAtual"));
        if(!dados) return;

        document.getElementById("nomeVendedor").value = dados.vendedor || "";
        if(document.getElementById("tipoOperacao") && dados.tipo) {
            document.getElementById("tipoOperacao").value = dados.tipo;
        }

        // rascunhos salvos antes dessa feature existir só tinham um
        // pesos/tipoPesagem/valorKg/descricao/rendimento solto -- vira um
        // Critério 1 único, mesmo formato de sempre
        let criterios = dados.criteriosPesagem;
        if(!criterios || !criterios.length){
            criterios = [{
                tipoPesagem: dados.tipoPesagem || "vivo",
                valorKg: dados.valorKg || "",
                rendimento: dados.rendimento || "",
                descricao: dados.descricao || "",
                pesos: dados.pesos || []
            }];
        }

        criteriosPesagem = criterios;
        criterioAtivoIndex = 0;
        pesos = criteriosPesagem[0].pesos;

        document.getElementById("descricao").value = criterios[0].descricao || "";
        if(document.getElementById("valorKg") && criterios[0].valorKg) {
            document.getElementById("valorKg").value = criterios[0].valorKg;
        }
        if(document.getElementById("tipoPesagem") && criterios[0].tipoPesagem) {
            document.getElementById("tipoPesagem").value = criterios[0].tipoPesagem;
        }
        if(document.getElementById("rendimentoArroba") && criterios[0].rendimento) {
            document.getElementById("rendimentoArroba").value = criterios[0].rendimento;
        }
        if(typeof alternarTipoPesagem === "function") {
            alternarTipoPesagem("");
        }

        // reabre os blocos de Critério 2/3, se o rascunho tinha eles
        [2, 3].forEach(n => {
            let criterio = criterios[n - 1];
            if(!criterio || typeof mostrarCriterioExtra !== "function") return;
            mostrarCriterioExtra(n);
            let tipoEl = document.getElementById("tipoPesagem" + n);
            let valorEl = document.getElementById("valorKg" + n);
            let rendEl = document.getElementById("rendimentoArroba" + n);
            let descEl = document.getElementById("descricao" + n);
            if(tipoEl) tipoEl.value = criterio.tipoPesagem || "vivo";
            if(valorEl) valorEl.value = criterio.valorKg || "";
            if(rendEl) rendEl.value = criterio.rendimento || "";
            if(descEl) descEl.value = criterio.descricao || "";
            if(typeof alternarTipoPesagem === "function") alternarTipoPesagem(String(n));
        });

        if(typeof atualizarStats === "function") {
            atualizarStats();
        }
    } catch(e) {}
}