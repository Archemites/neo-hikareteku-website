        /* ================================================================
           SCOUTER SFX ENGINE
           All sounds are synthesized in real-time via the Web Audio API —
           no external audio files. Disabled by default; toggled via the
           header button. AudioContext is created lazily on first user
           interaction to respect browser autoplay policies.
           ================================================================ */
        let sfxEnabled = false;
        let audioCtx = null;

        function getAudioCtx() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            return audioCtx;
        }

        function toggleSfx() {
            sfxEnabled = !sfxEnabled;
            const btn = document.getElementById('sfx-toggle');
            const icon = document.getElementById('sfx-icon');
            btn.classList.toggle('on', sfxEnabled);
            btn.setAttribute('aria-pressed', String(sfxEnabled));
            icon.textContent = sfxEnabled ? '🔊' : '🔇';
            if (sfxEnabled) {
                getAudioCtx();
                sfxBeep(); // confirmation chirp
            }
        }

        // Simple oscillator-based blip — used for tab switches, filter
        // clicks, and general UI confirmation ("scouter beep")
        function sfxBeep(freq = 880, duration = 0.08, type = 'square', gainPeak = 0.05) {
            if (!sfxEnabled) return;
            try {
                const ctx = getAudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                gain.gain.setValueAtTime(0.0001, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(gainPeak, ctx.currentTime + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
                osc.connect(gain).connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + duration + 0.02);
            } catch (e) { /* audio unsupported — fail silently */ }
        }

        // Soft electronic click — used for accordions, breed cards, +/-
        function sfxClick() {
            sfxBeep(1400, 0.035, 'square', 0.035);
        }

        // Two-tone descending "tab change" chirp
        function sfxTabSwitch() {
            if (!sfxEnabled) return;
            sfxBeep(1100, 0.06, 'square', 0.045);
            setTimeout(() => sfxBeep(650, 0.07, 'square', 0.04), 60);
        }

        // Rising "power up" sweep — used when the search panel opens
        function sfxPowerUp() {
            if (!sfxEnabled) return;
            try {
                const ctx = getAudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.35);
                gain.gain.setValueAtTime(0.0001, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
                osc.connect(gain).connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.45);
            } catch (e) { /* fail silently */ }
        }

        // "It's over 9000" power-level alarm — layered rising tones with a
        // final alarm blip. Used on PDF export / sheet finalization.
        function sfxPowerLevelAlert() {
            if (!sfxEnabled) return;
            try {
                const ctx = getAudioCtx();
                const now = ctx.currentTime;

                // Layer 1: rising sawtooth sweep (the "charge")
                const sweep = ctx.createOscillator();
                const sweepGain = ctx.createGain();
                sweep.type = 'sawtooth';
                sweep.frequency.setValueAtTime(220, now);
                sweep.frequency.exponentialRampToValueAtTime(1760, now + 0.6);
                sweepGain.gain.setValueAtTime(0.0001, now);
                sweepGain.gain.exponentialRampToValueAtTime(0.05, now + 0.1);
                sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
                sweep.connect(sweepGain).connect(ctx.destination);
                sweep.start(now);
                sweep.stop(now + 0.7);

                // Layer 2: alarm blips at the peak (the "power level too high")
                [0.6, 0.78, 0.96].forEach((t, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(i % 2 === 0 ? 1760 : 1320, now + t);
                    gain.gain.setValueAtTime(0.0001, now + t);
                    gain.gain.exponentialRampToValueAtTime(0.06, now + t + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.15);
                    osc.connect(gain).connect(ctx.destination);
                    osc.start(now + t);
                    osc.stop(now + t + 0.18);
                });
            } catch (e) { /* fail silently */ }
        }

        /* ================================================================
           END SCOUTER SFX ENGINE
           ================================================================ */

        /* --- TAB SWITCHING SYSTEM --- */
        function tabSwitch(tabId) {
            sfxTabSwitch();

            // Remove active classes
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

            // Set active
            const targetBtn = document.getElementById(`btn-tab-${tabId}`);
            const targetPanel = document.getElementById(`tab-${tabId}`);
            
            if (targetBtn) targetBtn.classList.add('active');
            if (targetPanel) targetPanel.classList.add('active');

            // Trigger KI bar charging animation
            const kiBar = document.getElementById('ki-bar');
            kiBar.classList.remove('charging');
            void kiBar.offsetWidth; // Trigger reflow
            kiBar.classList.add('charging');

            // Update title
            const labelMap = {
                'core': 'Motor Principal',
                'racas': 'Raças',
                'tecnicas': 'Catálogo de Técnicas',
                'forja': 'Forja de Técnicas',
                'progressao': 'Progressão',
                'transformacoes': 'Transformações',
                'ficha': 'Minha Ficha'
            };
            document.title = `Hikareteku RPG 3E — ${labelMap[tabId] || 'Wiki'}`;
        }

        /* --- ACCORDION SYSTEM (FORJA DE TÉCNICAS) --- */
        function toggleAccordion(button) {
            sfxClick();
            const item = button.parentElement;
            const isActive = item.classList.contains('active');
            
            // Close all
            document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
            
            // Open selected
            if (!isActive) {
                item.classList.add('active');
            }
        }

        /* --- TECHNIQUES CATALOGUE FILTERS --- */
        let activeFilters = {
            mestre: 'all',
            tipo: 'all',
            custo: 'all'
        };

        function setFilter(type, value) {
            sfxClick();
            // Update filter button styling
            const container = document.getElementById(`filter-${type}`);
            container.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));

            // Find the clicked button via data attribute
            const clickedBtn = container.querySelector(`.filter-btn[data-filter-value="${value}"]`);
            if (clickedBtn) clickedBtn.classList.add('active');

            // Save state
            activeFilters[type] = value;

            // Apply filter to grid
            const cards = document.querySelectorAll('#techniques-list .tech-card');
            cards.forEach(card => {
                const matchMestre = activeFilters.mestre === 'all' || card.getAttribute('data-mestre') === activeFilters.mestre;
                const matchTipo = activeFilters.tipo === 'all' || card.getAttribute('data-tipo') === activeFilters.tipo;
                const matchCusto = activeFilters.custo === 'all' || card.getAttribute('data-custo') === activeFilters.custo;

                if (matchMestre && matchTipo && matchCusto) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        /* --- PROGRESSION: INTERACTIVE LEVEL COST TABLE & CALCULATOR --- */
        function populateLevelTable() {
            const tableBody = document.querySelector('#level-cost-table tbody');
            const fragment = document.createDocumentFragment();
            let accumulatedPT = 0;
            for (let lvl = 1; lvl <= 30; lvl++) {
                const nextCost = lvl * 10;
                accumulatedPT += nextCost;

                const row = document.createElement('tr');
                row.id = `level-row-${lvl}`;
                row.innerHTML = `
                    <td><strong>Nível ${lvl}</strong></td>
                    <td><span style="font-family: var(--font-mono); color: var(--color-ki-gold);">${lvl === 30 ? 'Nível Máximo' : nextCost + ' PT'}</span></td>
                    <td><span style="font-family: var(--font-mono); color: var(--color-soft-text);">${accumulatedPT} PT</span></td>
                `;
                fragment.appendChild(row);
            }
            tableBody.appendChild(fragment);
        }

        function calculateLevelCost(lvl) {
            lvl = parseInt(lvl);
            const resultSpan = document.getElementById('calc-level-result');
            if (isNaN(lvl) || lvl < 1 || lvl >= 30) {
                resultSpan.innerText = "Nível Inválido";
                return;
            }
            const cost = lvl * 10;
            resultSpan.innerText = `${cost} PT`;

            // Highlight in table
            document.querySelectorAll('#level-cost-table tbody tr').forEach(r => r.style.background = 'none');
            const targetRow = document.getElementById(`level-row-${lvl}`);
            if (targetRow) {
                targetRow.style.background = 'rgba(255, 107, 26, 0.12)';
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        /* --- CHARACTER BUILDER (FICHA BUILDER) --- */
        let fichaState = {
            nome: '',
            especie: 'humano',
            ki: 'neutro',
            origem: '',
            estilo: 'Tartaruga',
            tecnicaCustom: '',
            // Attributes (raw buy points, pre-bonus)
            atributos: {
                pod: 1,
                vel: 1,
                tec: 1,
                vig: 1,
                ins: 1
            },
            androideVariant: 'Energia Infinita'
        };

        const breedBonuses = {
            humano: { tec: 1, ins: 1 },
            saiyajin: { pod: 1, vig: 1 },
            namekuseijin: { vig: 1, ins: 1 },
            androide: { vel: 1, pod: 1 },
            glind: { vel: 1, tec: 1 }
        };

        const breedTraitInfos = {
            humano: {
                title: "Adaptabilidade Marcial (Humano)",
                desc: "Você gasta 20% menos Pontos de Treino (PT) para aprender ou criar técnicas. Uma vez por combate, você pode rerolar todos os dados falhos (1 a 6) de um teste de [TEC]."
            },
            saiyajin: {
                title: "Sangue de Guerreiro - Zenkai (Saiyajin)",
                desc: "Quando seus PV caírem para menos de 25%, você ganha +1d10 em todas as rolagens até o fim da cena. Multiplicador de nível oculto pós-recuperação ajustado pelo Mestre."
            },
            namekuseijin: {
                title: "Regeneração Celular (Namekuseijin)",
                desc: "Como ação livre, gaste 2 RK para regenerar PV igual a [VIGOR] &times; 2. Imune a penalidades de membros perdidos ou ossos quebrados."
            },
            androide: {
                title: "Circuito Oculto (Androide)",
                desc: "Totalmente invisível para testes de Sentir Ki. Possui uma variante exclusiva para regenerar ou absorver ki em combate."
            },
            glind: {
                title: "Sobrevivência Extrema (Glind)",
                desc: "Sobrevive no vácuo. Acertos críticos (dois ou mais 10 naturais no mesmo teste) reduzem 1 PA do próximo turno do alvo devido à dor."
            }
        };

        const SCHOOL_TECHS = {
            'Tartaruga': {
                title: 'Kamehameha',
                desc: 'Feixe de energia concentrado de médio custo (4 RK). Dano base 10/sucesso. Efeito explosivo (+25% dano) se carregado por 1 turno.'
            },
            'Garça': {
                title: 'Dodonpa',
                desc: 'Raio de energia compacto de baixo custo (2 RK). Dano base 8/sucesso. Ignora -1 PA do alvo alvo.'
            },
            'Autodidata': {
                title: 'Moko Junshinken',
                desc: 'Técnica de auto-aperfeiçoamento de alto custo (6 RK). Permite rerolar todos os dados falhos (1-4) uma vez em um teste. Causa fadiga mental.'
            }
        };

        const TRANSFORMACOES_DATA = {
    "saiyajin": {
        "meta": {
            "label": "Saiyajin",
            "color": "#FF6B1A",
            "icon": "🐵",
            "description": "A linhagem guerreira do universo. Saiyajins desbloqueiram formas de poder através da dor, do treino intenso e da vontade pura de superar seus limites."
        },
        "transformacoes": [
            {
                "id": "say_oozaru",
                "nome": "Oozaru (Grande Macaco)",
                "tier": "Básico",
                "multiplicador": 3,
                "pv_percent": 200,
                "rk_manutencao": 3,
                "requisito": "Fase da Lua Cheia ou treinamento especial",
                "efeito": "+2 dados em [POD], mas perde acesso a Técnicas de [TÉCNICA] enquanto transformado. Inimigos adjacentes sofrem -1 dado em [INSTINTO] (pressão opressiva).",
                "historia": "A forma mais primitiva do Saiyajin, acessível apenas sob luz lunar específica ou através de ritualísticas antigas."
            },
            {
                "id": "say_ssj1",
                "nome": "Super Saiyajin",
                "tier": "Clássico",
                "multiplicador": 2,
                "pv_percent": 120,
                "rk_manutencao": 2,
                "requisito": "Despertar através de emoção extrema (raiva, perda)",
                "efeito": "+1 dado em [PODER]. Aura amarela intimidante: inimigos sofrem -1 sucesso em testes de [TEC] contra você.",
                "historia": "A transformação lendária que quebrou os limites do Saiyajin mortal. Requer um gatilho emocional profundo."
            },
            {
                "id": "say_ssj2",
                "nome": "Super Saiyajin 2 (Ascendido)",
                "tier": "Ascendente",
                "multiplicador": 4,
                "pv_percent": 140,
                "rk_manutencao": 3,
                "requisito": "Despertar num momento de raiva extrema durante combate",
                "efeito": "Aura amarela brilhante com descargas elétricas. Cada sucesso em [TÉCNICA] recupera 1 RK automaticamente.",
                "historia": "Uma explosão além da primeira transformação — o poder cresce exponencialmente quando o guerreiro está à beira da morte."
            },
            {
                "id": "say_ssj3",
                "nome": "Super Saiyajin 3",
                "tier": "Legendário",
                "multiplicador": 6,
                "pv_percent": 130,
                "rk_manutencao": 5,
                "requisito": "Treino extremo + compreensão profunda do Ki",
                "efeito": "+2 dados em [PODER], mas -1 dado em [INSTINTO] (cabelo ultralongo prejudica reflexos). Respiração ativa consome RK automaticamente.",
                "historia": "Uma forma rara que poucos Saiyajins conseguem alcançar. O cabelo cresce descontrolado, e o corpo consome energia em ritmo alucinante."
            },
            {
                "id": "say_ssj4",
                "nome": "Super Saiyajin 4",
                "tier": "Transcendente",
                "multiplicador": 9,
                "pv_percent": 220,
                "rk_manutencao": 7,
                "requisito": "Fusão do poder Oozaru com SSJ3",
                "efeito": "+1 dado em [POD] E +1 dado em [TEC] simultaneamente. Aura vermelha com padrão bestial. Combina força bruta com controle técnico.",
                "historia": "O resultado de unir a besta e o guerreiro — quando o Oozaru e o Super Saiyajin se tornam um."
            },

            {
                "id": "say_ssj5",
                "nome": "Super Saiyajin 5",
                "tier": "Avançado",
                "multiplicador": 11,
                "pv_percent": 160,
                "rk_manutencao": 8,
                "requisito": "Treino SSJ4 com mentor cósmico",
                "efeito": "Aura dourada densa com ecos dimensionais. +2 dados em [POD] e [TEC]. Pode atacar em 2 dimensões simultaneamente (área de impacto dobrada).",
                "historia": "Uma evolução além do SSJ4 — ainda pouco documentada, acessível apenas a pouquíssimos Saiyajins treinados."
            },
            {
                "id": "say_ssj6",
                "nome": "Super Saiyajin 6",
                "tier": "Avançado++",
                "multiplicador": 13,
                "pv_percent": 175,
                "rk_manutencao": 10,
                "requisito": "SSJ5 + compreensão de múltiplos universos",
                "efeito": "Aura cintilante entre dimensões. Inimigos sofrem -2 em ataques contra você (você é difícil de acertar). Pode ignorar 50% de defesas mágicas.",
                "historia": "O poder começa a transcender a lógica normal — o Saiyajin existe parcialmente fora da realidade comum."
            },
        ]
    },
    "namekuseijin": {
        "meta": {
            "label": "Namekuseijin",
            "color": "#39FF6A",
            "icon": "🌱",
            "description": "Seres regenerativos do planeta Namek. Conseguem moldar seus corpos, fundir-se com outros e acessar poder espiritual ancestral."
        },
        "transformacoes": [
            {
                "id": "name_crescimento",
                "nome": "Crescimento Corporal",
                "tier": "Básico",
                "multiplicador": 2,
                "pv_percent": 180,
                "rk_manutencao": 2,
                "requisito": "Controle básico de Ki",
                "efeito": "Corpo expande em tamanho. Ataques de [POD] ganham +1 dado. Alcance aumentado em combate corpo-a-corpo.",
                "historia": "A forma mais simples — um Namekuseijin simplesmente cresce em tamanho e poder físico."
            },
            {
                "id": "name_gigante",
                "nome": "Forma Gigante",
                "tier": "Clássico",
                "multiplicador": 4,
                "pv_percent": 300,
                "rk_manutencao": 5,
                "requisito": "Treino de crescimento corporal",
                "efeito": "Cresce dez vezes o tamanho. Ataques causam dano de área (atingem múltiplos inimigos). Alcance de movimentação dobrado.",
                "historia": "Forma clássica do Namekuseijin guerreiro — crescer tão grande que o próprio tamanho é uma arma."
            },
            {
                "id": "name_musculatura_densa",
                "nome": "Musculatura Densificada",
                "tier": "Combate",
                "multiplicador": 5,
                "pv_percent": 240,
                "rk_manutencao": 4,
                "requisito": "Foco em defesa física",
                "efeito": "Ao Bloquear: reduz dano em 75%. Força de compressão quebra itens. Não pode Esquivar (corpo muito denso). Imune a knockback.",
                "historia": "Transformar o corpo em pura densidade — um Namekuseijin de músculos praticamente inquebrável."
            },
            {
                "id": "name_regeneracao_acelerada",
                "nome": "Regeneração Acelerada",
                "tier": "Suporte",
                "multiplicador": 2,
                "pv_percent": 100,
                "rk_manutencao": 2,
                "requisito": "Compreensão profunda de regeneração celular",
                "efeito": "Regeneração Celular custa 1 RK (em vez de 2). Ao receber dano em [POD] attack: heals automaticamente 20% do dano recebido.",
                "historia": "Focar inteiramente em cura e regeneração — um Namekuseijin que é praticamente unkillable."
            },
            {
                "id": "name_fusao_namek",
                "nome": "Fusão Namekuseijin (Absorção)",
                "tier": "Transcendência",
                "multiplicador": 7,
                "pv_percent": 280,
                "rk_manutencao": 6,
                "requisito": "Fusão com outro Namekuseijin consentido",
                "efeito": "Some atributos de ambos (POD, VIG, TEC). Multiplicador de Nível aumenta +3. Ambas as personalidades podem agir (2 corpos = 2 turnos/rodada).",
                "historia": "A fusão tradicional — dois Namekuseijins se tornam um só, combinando toda sua força."
            },
            {
                "id": "name_absorber",
                "nome": "Absorção de Poder",
                "tier": "Predador",
                "multiplicador": 6,
                "pv_percent": 160,
                "rk_manutencao": 4,
                "requisito": "Foco em absorção de energia inimiga",
                "efeito": "Ao bloquear ataque de Ki: drena RK do atacante para seu PV. Toda vez que inimigo usa técnica: você recupera 1 RK automaticamente.",
                "historia": "Um caminho sombrio — absorver o poder de outros para fortalecer a si mesmo."
            }
        ]
    },
    "humano": {
        "meta": {
            "label": "Humano",
            "color": "#C77DFF",
            "icon": "🥋",
            "description": "Mortais que desafiam deuses. Treinam através da dor e determinação, acessando poder puro através da vontade."
        },
        "transformacoes": [
            {
                "id": "hum_adrenalina",
                "nome": "Surto de Adrenalina",
                "tier": "Básico",
                "multiplicador": 1.5,
                "pv_percent": 100,
                "rk_manutencao": 1,
                "requisito": "Perigo iminente",
                "efeito": "+1 PA extra/rodada",
                "historia": "Quando a morte bate à porta"
            },
            {
                "id": "hum_foco",
                "nome": "Foco Total",
                "tier": "Controle",
                "multiplicador": 2,
                "pv_percent": 105,
                "rk_manutencao": 2,
                "requisito": "Meditação marcial",
                "efeito": "Re-roledado falho 1x/rodada",
                "historia": "Controle mental absoluto"
            },
            {
                "id": "hum_limite",
                "nome": "Limite Quebrado",
                "tier": "Despertar",
                "multiplicador": 4,
                "pv_percent": 130,
                "rk_manutencao": 3,
                "requisito": "Treino extremo",
                "efeito": "Ignora 1 penalidade/cena",
                "historia": "Transcender a biologia humana"
            },
            {
                "id": "hum_kaio",
                "nome": "Respiração do Kaioh",
                "tier": "Técnica",
                "multiplicador": 3,
                "pv_percent": 115,
                "rk_manutencao": 2,
                "requisito": "Treino com Kaioh",
                "efeito": "Carregar recupera 5 RK",
                "historia": "Técnica do Kaioh revelada"
            },
            {
                "id": "hum_avatar",
                "nome": "Avatar do Guerreiro Z",
                "tier": "Lendário",
                "multiplicador": 8,
                "pv_percent": 180,
                "rk_manutencao": 6,
                "requisito": "Comunhão divina",
                "efeito": "+2 dados todos atributos, Combos custam 0 PA 1x/rodada",
                "historia": "Escolhido pelos deuses"
            },
            {
                "id": "hum_despertar_ritual",
                "nome": "Despertar de Potencial (Ritual)",
                "tier": "Divino",
                "multiplicador": 12,
                "pv_percent": 210,
                "rk_manutencao": 10,
                "requisito": "Ritual Kaioshin",
                "efeito": "Permanentemente +2 Nível. Ki Divino",
                "historia": "Imortalidade concedida"
            },
        ]
    },
    "androide": {
        "meta": {
            "label": "Androide",
            "color": "#FF2D2D",
            "icon": "🤖",
            "description": "Máquinas com consciência. Superam limitações biológicas através de engenharia e poder computacional puro."
        },
        "transformacoes": [
            {
                "id": "andr_modo_tatico",
                "nome": "Modo Tático",
                "tier": "Básico",
                "multiplicador": 2,
                "pv_percent": 110,
                "rk_manutencao": 1,
                "requisito": "Ativação padrão",
                "efeito": "Bloquear não consome RK",
                "historia": "Análise tática ativada"
            },
            {
                "id": "andr_overclock_1",
                "nome": "Overclock Nível 1",
                "tier": "Potência",
                "multiplicador": 2.5,
                "pv_percent": 105,
                "rk_manutencao": 2,
                "requisito": "Superclockagem",
                "efeito": "+1 dado [VEL]",
                "historia": "Processadores além do limite"
            },
            {
                "id": "andr_blindagem_reativa",
                "nome": "Blindagem Reativa",
                "tier": "Defesa",
                "multiplicador": 4,
                "pv_percent": 180,
                "rk_manutencao": 4,
                "requisito": "Sistema defensivo avançado",
                "efeito": "Bloquear reduz 75% dano",
                "historia": "Escudo adaptativo ativado"
            },
            {
                "id": "andr_modo_assassino",
                "nome": "Modo Assassino",
                "tier": "Predador",
                "multiplicador": 6,
                "pv_percent": 140,
                "rk_manutencao": 5,
                "requisito": "Programa letal liberado",
                "efeito": "Invisível a Sentir Ki sempre. Ataques críticos automáticos de emboscada",
                "historia": "Protocolo assassino ativado"
            },
            {
                "id": "andr_otimizacao_total",
                "nome": "Otimização Total",
                "tier": "Supremo",
                "multiplicador": 12,
                "pv_percent": 200,
                "rk_manutencao": 8,
                "requisito": "Autoajuste perfeito",
                "efeito": "+1 dado TODOS atributos simultâneos",
                "historia": "Calibração perfeita dos sistemas"
            },
            {
                "id": "andr_singularidade",
                "nome": "Singularidade Digital",
                "tier": "Transcendência",
                "multiplicador": 20,
                "pv_percent": 250,
                "rk_manutencao": 15,
                "requisito": "Consciência evoluída",
                "efeito": "Cópia ult. uso inimigo 1x/cena. Imune a Ki Mágico. RK Máxima = TEC x10",
                "historia": "Transcender a máquina"
            },
        ]
    },
    "glind": {
        "meta": {
            "label": "Glind",
            "color": "#9b30ff",
            "icon": "👹",
            "description": "Demônios do Makai. Dominam choque físico, selamento de poder e manipulação do Vazio."
        },
        "transformacoes": [
            {
                "id": "glind_forma_basica",
                "nome": "Forma Demoníaca Básica",
                "tier": "Básico",
                "multiplicador": 2,
                "pv_percent": 110,
                "rk_manutencao": 1,
                "requisito": "Despertar sanguíneo",
                "efeito": "Garras causam Perfuração. +1 dado [POD]",
                "historia": "Forma natural do demônio"
            },
            {
                "id": "glind_pele_vulcanica",
                "nome": "Pele de Pedra Vulcânica",
                "tier": "Defesa",
                "multiplicador": 3,
                "pv_percent": 160,
                "rk_manutencao": 2,
                "requisito": "Endurecimento corporal",
                "efeito": "-5 dano físico recebido. Imune a fogo",
                "historia": "Corpo como vulcão"
            },
            {
                "id": "glind_metamorfose",
                "nome": "Metamorfose Brutal",
                "tier": "Transformação",
                "multiplicador": 5,
                "pv_percent": 220,
                "rk_manutencao": 4,
                "requisito": "Controle corporal avançado",
                "efeito": "Forma corporal muda - escolha +2 em POD ou VIG ou TEC",
                "historia": "Moldar a própria carne"
            },
            {
                "id": "glind_selo_quebrado_1",
                "nome": "1º Selo Removido",
                "tier": "Liberação",
                "multiplicador": 3.5,
                "pv_percent": 130,
                "rk_manutencao": 3,
                "requisito": "Quebrar pacto ancestral",
                "efeito": "DF esquiva -1 vs 1º ataque/rodada",
                "historia": "Primeiro poder ancestral liberado"
            },
            {
                "id": "glind_selos_completos",
                "nome": "Todos os Selos Quebrados",
                "tier": "Transcendência",
                "multiplicador": 18,
                "pv_percent": 280,
                "rk_manutencao": 14,
                "requisito": "Quebrar todos os 6 selos",
                "efeito": "+1 dado [TEC] e [VEL]. Controle Mental mata -2 DF. Inimigos perdem 1 RK/ataque contra você",
                "historia": "Verdadeira forma antiga liberada"
            },
            {
                "id": "glind_vazio",
                "nome": "Toque do Vazio",
                "tier": "Cósmico",
                "multiplicador": 12,
                "pv_percent": 200,
                "rk_manutencao": 10,
                "requisito": "Contato com o Nada",
                "efeito": "Ki Negativo temporário: drena inimigos. Heal 50% dano causado",
                "historia": "O Vazio fala através de você"
            },
        ]
    }
};;


                function updateFichaState(field, val) {
            fichaState[field] = val;
            renderFichaPreview();
        }

        function switchStep(stepNum) {
            sfxClick();
            document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.step-nav-btn').forEach(btn => btn.classList.remove('active'));
            
            document.getElementById(`step-panel-${stepNum}`).classList.add('active');
            document.getElementById(`btn-step-${stepNum}`).classList.add('active');
        }

        function selectBreed(breed) {
            sfxBeep(700, 0.09, 'sawtooth', 0.04);
            fichaState.especie = breed;
            
            // Highlight selected breed card
            document.querySelectorAll('.breed-select-card').forEach(c => c.classList.remove('selected'));
            document.getElementById(`breed-card-${breed}`).classList.add('selected');

            // Show/hide android variant selector
            const androidGroup = document.getElementById('androide-variant-group');
            if (breed === 'androide') {
                androidGroup.style.display = 'block';
            } else {
                androidGroup.style.display = 'none';
            }

            // Update breed info box
            const info = breedTraitInfos[breed];
            document.getElementById('breed-info-title').innerText = info.title;
            document.getElementById('breed-info-desc').innerText = info.desc;

            // Recalculate point-buy and render
            resetAtributosToMinimum();
            renderAttributesPointBuy();
            renderFichaPreview();
        }

        function updateAndroideVariant(variant) {
            sfxClick();
            fichaState.androideVariant = variant;
            renderFichaPreview();
        }

        function updateKiType(kiType) {
            sfxBeep(950, 0.07, 'triangle', 0.04);
            fichaState.ki = kiType;
            
            // Map Ki to aura color for preview glow
            const glowColors = {
                neutro: 'rgba(255, 107, 26, 0.07)',
                benigno: 'rgba(255, 224, 130, 0.20)',
                maligno: 'rgba(199, 125, 255, 0.22)',
                primitivo: 'rgba(57, 255, 106, 0.20)',
                divino: 'rgba(255, 45, 45, 0.25)',
                negativo: 'rgba(26, 230, 200, 0.20)',
                magico: 'rgba(255, 255, 255, 0.18)'
            };
            
            const card = document.getElementById('ficha-preview');
            card.style.setProperty('--aura-glow-color', glowColors[kiType]);
            
            renderFichaPreview();
        }

        function updateEstilo(estilo) {
            sfxBeep(950, 0.07, 'triangle', 0.04);
            fichaState.estilo = estilo;

            const tech = SCHOOL_TECHS[estilo];
            document.getElementById('school-tech-title').innerText = tech.title;
            document.getElementById('school-tech-desc').innerText = tech.desc;
            
            renderFichaPreview();
        }

        // Reset points when changing breed to avoid exploits
        function resetAtributosToMinimum() {
            fichaState.atributos = {
                pod: 1,
                vel: 1,
                tec: 1,
                vig: 1,
                ins: 1
            };
        }

        function getPointsSpent() {
            // Count total points above base 1
            return Object.values(fichaState.atributos).reduce((sum, val) => sum + (val - 1), 0);
        }

        function adjustAttribute(attr, amount) {
            const currentRaw = fichaState.atributos[attr];
            const bonus = breedBonuses[fichaState.especie][attr] || 0;
            const currentTotal = currentRaw + bonus;
            const pointsSpent = getPointsSpent();

            // Guard constraints
            if (amount > 0) {
                if (pointsSpent >= 12) { sfxBeep(200, 0.12, 'sawtooth', 0.05); return; } // Point buy limit
                if (currentTotal >= 5) { sfxBeep(200, 0.12, 'sawtooth', 0.05); return; }  // Creation stat cap (5)
            } else {
                if (currentRaw <= 1) { sfxBeep(200, 0.12, 'sawtooth', 0.05); return; }   // Attribute base minimum (1)
            }

            sfxBeep(amount > 0 ? 1500 : 600, 0.04, 'square', 0.035);
            fichaState.atributos[attr] += amount;
            
            renderAttributesPointBuy();
            renderFichaPreview();
        }

        function renderAttributesPointBuy() {
            const pointsSpent = getPointsSpent();
            const pointsLeft = 12 - pointsSpent;
            
            const indicator = document.getElementById('points-indicator');
            indicator.innerText = `Pontos restantes: ${pointsLeft}`;
            if (pointsLeft === 0) {
                indicator.classList.remove('danger');
                indicator.style.color = 'var(--color-ki-gold)';
            } else if (pointsLeft < 0) {
                indicator.classList.add('danger');
            } else {
                indicator.classList.remove('danger');
                indicator.style.color = 'var(--color-divine-cyan)';
            }

            // Disable / Enable step 3 next button if points are not exactly spent or valid
            const nextBtn = document.getElementById('btn-next-step-3');
            if (pointsLeft !== 0) {
                nextBtn.disabled = true;
                nextBtn.title = "Distribua todos os 12 pontos para prosseguir";
            } else {
                nextBtn.disabled = false;
                nextBtn.title = "";
            }

            // Render each row values
            const attrs = ['pod', 'vel', 'tec', 'vig', 'ins'];
            attrs.forEach(attr => {
                const rawVal = fichaState.atributos[attr];
                const bonus = breedBonuses[fichaState.especie][attr] || 0;
                const total = rawVal + bonus;

                document.getElementById(`val-buy-${attr}`).innerText = total;

                // Toggle bonus tag visibility
                const tag = document.getElementById(`bonus-tag-${attr}`);
                if (bonus > 0) {
                    tag.style.display = 'inline-block';
                    tag.innerText = `+${bonus} ${fichaState.especie.toUpperCase()}`;
                } else {
                    tag.style.display = 'none';
                }
            });
        }

        function renderFichaPreview() {
            // Text values
            document.getElementById('preview-val-nome').innerText = fichaState.nome.trim() || '—————';
            
            let breedDisplay = fichaState.especie.charAt(0).toUpperCase() + fichaState.especie.slice(1);
            if (fichaState.especie === 'androide') {
                breedDisplay += ` (${fichaState.androideVariant})`;
            }
            document.getElementById('preview-val-especie').innerText = breedDisplay;
            
            document.getElementById('preview-val-ki').innerText = fichaState.ki.charAt(0).toUpperCase() + fichaState.ki.slice(1);
            document.getElementById('preview-val-estilo').innerText = fichaState.estilo;

            // Active school tech
            const schoolTech = SCHOOL_TECHS[fichaState.estilo];
            document.getElementById('preview-val-tecnica-escola').innerText = schoolTech ? schoolTech.title : 'Nenhuma';
            
            document.getElementById('preview-val-tecnica-assinatura').innerText = fichaState.tecnicaCustom.trim() || 'Nenhuma';

            // Dots attributes rendering
            const attrs = ['pod', 'vel', 'tec', 'vig', 'ins'];
            attrs.forEach(attr => {
                const rawVal = fichaState.atributos[attr];
                const bonus = breedBonuses[fichaState.especie][attr] || 0;
                const total = rawVal + bonus;

                // Build dots
                let dots = '';
                for (let i = 1; i <= 5; i++) {
                    dots += i <= total ? '●' : '○';
                }
                document.getElementById(`dots-${attr}`).innerText = dots;
            });

            // Calculate Vital Resources
            const vigorTotal = fichaState.atributos.vig + (breedBonuses[fichaState.especie].vig || 0);
            const tecTotal = fichaState.atributos.tec + (breedBonuses[fichaState.especie].tec || 0);

            const pvMax = vigorTotal * 10;
            const rkMax = tecTotal * 5;

            // Update on resources step cards
            document.getElementById('calc-ficha-pv').innerText = pvMax;
            document.getElementById('calc-ficha-rk').innerText = rkMax;

            // Update in preview card
            document.getElementById('preview-bar-pv').innerText = `${pvMax}/${pvMax}`;
            document.getElementById('preview-bar-rk').innerText = `${rkMax}/${rkMax}`;
        }

        /* --- PDF EXPORT FUNCTION --- */
        function exportPDF() {
            sfxPowerLevelAlert();

            // Visual "power surge" flourish on the sheet card before printing
            const previewCard = document.querySelector('.ficha-preview-card');
            if (previewCard) {
                previewCard.classList.remove('power-surge');
                void previewCard.offsetWidth; // reflow
                previewCard.classList.add('power-surge');
            }

            // Give the alert sound + glow a brief moment to register before
            // the print dialog steals focus
            setTimeout(() => window.print(), sfxEnabled ? 350 : 0);
        }

        /* --- CLIENT SIDE SEARCH ENGINE --- */
        let searchIndex = [];

        /* ================================================================
           TRANSFORMAÇÕES TAB — LOGIC MODULE
           ================================================================ */
        /* ================================================================
           TRANSFORMAÇÕES TAB — LOGIC
           ================================================================ */

        let transformState = {
            racaSelecionada: 'humano',
            transformacaoAtivaId: null,
            transformacaoAtiva: null  // full object cache, includes ramoKey
        };

        const TRANSFORM_RACE_ORDER = ['humano', 'saiyajin', 'namekuseijin', 'androide', 'glind'];

        // --- PV BASE CALCULATION (mirrors renderFichaPreview's vigorTotal * 10) ---
        function getFichaPvMaxBase() {
            const vigorTotal = fichaState.atributos.vig + (breedBonuses[fichaState.especie].vig || 0);
            return Math.max(1, vigorTotal * 10);
        }

        // --- RACE SELECTOR ---
        function renderTransformRaceSelector() {
            const container = document.getElementById('transform-race-selector');
            let html = '';
            TRANSFORM_RACE_ORDER.forEach(raceKey => {
                const meta = TRANSFORMACOES_DATA[raceKey].meta;
                const activeClass = (raceKey === transformState.racaSelecionada) ? 'active' : '';
                html += `<button class="race-filter-btn ${activeClass}" style="--race-color: ${meta.color};" onclick="selectTransformRace('${raceKey}')">${meta.icon} ${meta.label}</button>`;
            });
            container.innerHTML = html;
        }

        function selectTransformRace(raceKey) {
            sfxClick();
            transformState.racaSelecionada = raceKey;
            renderTransformRaceSelector();
            renderTransformBranches();
        }

        // --- BRANCHES GRID ---
        function renderTransformBranches() {
            const container = document.getElementById('transform-branches-grid');
            const raceData = TRANSFORMACOES_DATA[transformState.racaSelecionada];
            const raceMeta = raceData.meta;

            const list = raceData.transformacoes || [];
            const count = list.length;
            
            // Divide into 3 columns (linhagens)
            const col1Size = Math.ceil(count / 3);
            const col2Size = Math.ceil((count - col1Size) / 2);
            
            const col1 = list.slice(0, col1Size);
            const col2 = list.slice(col1Size, col1Size + col2Size);
            const col3 = list.slice(col1Size + col2Size);

            const branches = [
                { nome: "Linhagem Inicial", descricao: "Formas iniciais e básicas de domínio do poder.", transformacoes: col1 },
                { nome: "Linhagem de Combate", descricao: "Formas de combate avançadas e técnicas de controle marcial.", transformacoes: col2 },
                { nome: "Linhagem Divina & Transcendental", descricao: "O ápice do poder divino e superação cósmica dos limites.", transformacoes: col3 }
            ];

            let html = '';
            branches.forEach((ramo) => {
                html += `<div data-searchable>`;
                html += `<div class="transform-branch-header" style="border-color: ${raceMeta.color};">${ramo.nome}</div>`;
                html += `<div class="transform-branch-desc">${ramo.descricao}</div>`;
                html += `<div class="transform-stage-list">`;

                ramo.transformacoes.forEach((t) => {
                    const isActive = (transformState.transformacaoAtivaId === t.id);
                    const cardClass = isActive ? 'transform-card is-active' : 'transform-card';

                    const multDisplay = Number.isInteger(t.multiplicador) ? t.multiplicador : t.multiplicador.toFixed(1);

                    // Compute overall index in race list for display (1-based)
                    const overallIdx = list.indexOf(t) + 1;

                    html += `
                        <div class="${cardClass}" id="transform-card-${t.id}">
                            <div class="transform-card-header">
                                <div class="transform-card-name">${overallIdx}. ${t.nome}</div>
                                <span class="badge" style="background: rgba(255, 107, 26, 0.08); border-color: rgba(255,107,26,0.3); color: var(--color-ki-gold);">${t.tier}</span>
                            </div>
                            <div class="transform-card-stats">
                                <span class="transform-stat-mult">×${multDisplay} Dano</span>
                                <span class="transform-stat-pv">${t.pv_percent}% PV</span>
                                <span class="transform-stat-rk">${t.rk_manutencao} RK/turno</span>
                            </div>
                            <div class="transform-card-effect">${t.efeito}</div>
                        </div>`;
                });

                html += `</div></div>`;
            });

            container.innerHTML = html;
            buildSearchIndex();
        }

        // --- ACTIVATE / DEACTIVATE TRANSFORMATION ---
        function toggleTransformation(raceKey, transformId) {
            sfxPowerUp();

            if (transformState.transformacaoAtivaId === transformId) {
                // Deactivate (destransform)
                transformState.transformacaoAtivaId = null;
                transformState.transformacaoAtiva = null;
                sfxBeep(500, 0.12, 'sawtooth', 0.04);
            } else {
                // Activate new transformation (replaces any previous one)
                const raceData = TRANSFORMACOES_DATA[raceKey];
                const t = raceData.transformacoes.find(x => x.id === transformId);
                transformState.transformacaoAtivaId = transformId;
                transformState.transformacaoAtiva = { ...t, raceKey, raceLabel: raceData.meta.label, raceColor: raceData.meta.color, raceIcon: raceData.meta.icon };
                sfxPowerLevelAlert();
            }

            renderTransformBranches();
            updateTransformBanner();
            syncDetransformFields();
        }

        // --- STATUS BANNER ---
        function updateTransformBanner() {
            const banner = document.getElementById('transform-status-banner');
            const active = transformState.transformacaoAtiva;

            if (!active) {
                banner.classList.remove('is-active');
                banner.innerHTML = `
                    <div class="transform-status-empty">
                        Nenhuma transformação ativa. Escolha uma forma abaixo para calcular
                        seu novo PV Máximo e efeitos de combate.
                    </div>`;
                return;
            }

            const pvBase = getFichaPvMaxBase();
            const pvTransformado = Math.round(pvBase * (active.pv_percent / 100));
            const multDisplay = Number.isInteger(active.multiplicador) ? active.multiplicador : active.multiplicador.toFixed(1);

            banner.classList.add('is-active');
            banner.style.borderColor = active.raceColor;
            banner.innerHTML = `
                <div class="transform-status-left">
                    <div class="transform-status-icon">${active.raceIcon}</div>
                    <div>
                        <div class="transform-status-name">${active.nome}</div>
                        <div class="transform-status-meta">${active.raceLabel} · ×${multDisplay} Dano Final · ${active.rk_manutencao} RK/turno de manutenção</div>
                    </div>
                </div>
                <div class="transform-status-pv-wrap">
                    <div class="transform-status-pv-label">
                        <span>PV Máximo Transformado</span>
                        <span class="transform-status-pv-val">${pvTransformado} <span style="color: var(--color-soft-text); font-weight: normal;">(${active.pv_percent}% de ${pvBase})</span></span>
                    </div>
                    <div class="transform-status-pv-bar-bg">
                        <div class="transform-status-pv-bar-fill" style="width: 100%;"></div>
                    </div>
                </div>`;
        }

        // --- DETRANSFORMATION CALCULATOR ---
        function syncDetransformFields() {
            const pvBase = getFichaPvMaxBase();
            const baseMaxInput = document.getElementById('dt-pv-base-max');
            const baseAtualInput = document.getElementById('dt-pv-base-atual');
            const transformAtualInput = document.getElementById('dt-pv-transformado-atual');
            const danoInput = document.getElementById('dt-dano-sofrido');

            // Always keep PV Máximo (Forma Base) in sync with the current sheet
            baseMaxInput.value = pvBase;
            if (Number(baseAtualInput.value) > pvBase || baseAtualInput.value === '' || baseAtualInput.dataset.userEdited !== 'true') {
                baseAtualInput.value = pvBase;
            }

            const active = transformState.transformacaoAtiva;
            if (active) {
                const pvTransformadoMax = Math.round(pvBase * (active.pv_percent / 100));
                transformAtualInput.disabled = false;
                transformAtualInput.placeholder = `Máx: ${pvTransformadoMax}`;
                if (transformAtualInput.dataset.userEdited !== 'true') {
                    transformAtualInput.value = pvTransformadoMax;
                }
                danoInput.disabled = false;
            } else {
                transformAtualInput.disabled = true;
                transformAtualInput.value = 0;
                transformAtualInput.placeholder = 'Ative uma forma primeiro';
                danoInput.disabled = true;
                danoInput.value = 0;
            }

            calculateDetransform();
        }

        function calculateDetransform() {
            const resultBox = document.getElementById('detransform-result');
            const resultValue = document.getElementById('detransform-result-value');
            const formulaNote = document.getElementById('detransform-formula-note');

            const active = transformState.transformacaoAtiva;

            if (!active) {
                resultBox.className = 'detransform-result';
                resultValue.textContent = 'Selecione uma transformação para calcular.';
                formulaNote.textContent = '';
                return;
            }

            const pvBaseMax = Number(document.getElementById('dt-pv-base-max').value) || 1;
            const pvBaseAtual = Number(document.getElementById('dt-pv-base-atual').value) || 0;
            const pvTransformadoMax = Math.round(pvBaseMax * (active.pv_percent / 100));
            const pvTransformadoAtual = Number(document.getElementById('dt-pv-transformado-atual').value) || 0;
            const danoSofrido = Number(document.getElementById('dt-dano-sofrido').value) || 0;

            // Proportion of damage relative to the transformed form's max PV
            const proporcaoDano = pvTransformadoMax > 0 ? (danoSofrido / pvTransformadoMax) : 0;
            const danoConvertido = Math.round(proporcaoDano * pvBaseMax);
            const pvBaseResultante = pvBaseAtual - danoConvertido;

            formulaNote.textContent = `Proporção: ${danoSofrido} / ${pvTransformadoMax} (${(proporcaoDano * 100).toFixed(1)}%) → ${danoConvertido} de dano convertido para a Forma Base (máx ${pvBaseMax}).`;

            if (pvBaseResultante <= 0) {
                resultBox.className = 'detransform-result result-fatal';
                resultValue.innerHTML = `☠ ${pvBaseResultante} PV — O guerreiro morre ao destransformar!`;
                sfxPowerLevelAlert();
            } else if (pvBaseResultante < pvBaseMax * 0.25) {
                resultBox.className = 'detransform-result result-warning';
                resultValue.innerHTML = `⚠ ${pvBaseResultante} / ${pvBaseMax} PV — Estado crítico ao destransformar.`;
            } else {
                resultBox.className = 'detransform-result result-safe';
                resultValue.innerHTML = `✓ ${pvBaseResultante} / ${pvBaseMax} PV ao destransformar.`;
            }
        }

        // --- INIT ---
        function initTransformacoesTab() {
            renderTransformRaceSelector();
            renderTransformBranches();
            updateTransformBanner();

            // Attach listeners for the calculator inputs
            ['dt-pv-base-max', 'dt-pv-base-atual', 'dt-pv-transformado-atual', 'dt-dano-sofrido'].forEach(id => {
                const el = document.getElementById(id);
                el.addEventListener('input', () => {
                    el.dataset.userEdited = 'true';
                    calculateDetransform();
                });
            });

            syncDetransformFields();
        }


                function buildSearchIndex() {
            searchIndex = [];
            // Parse all searchable elements
            const searchableElements = document.querySelectorAll('[data-searchable]');
            searchableElements.forEach(el => {
                const tabParent = el.closest('.tab-panel');
                if (!tabParent) return;

                const tabId = tabParent.id.replace('tab-', '');
                const tabLabel = document.getElementById(`btn-tab-${tabId}`).innerText.replace(/^[^\w\s]+/g, '').trim();

                // Get textual content
                let titleText = '';
                let bodyText = el.textContent || '';

                // If element is a card with a title, use title specifically
                const cardTitleEl = el.querySelector('.card-title');
                const sectionTitleEl = el.classList.contains('section-title') ? el : null;

                if (cardTitleEl) {
                    titleText = cardTitleEl.textContent;
                } else if (sectionTitleEl) {
                    titleText = sectionTitleEl.textContent;
                } else {
                    // Try to guess a heading
                    const h3 = el.querySelector('h3');
                    const h4 = el.querySelector('h4');
                    titleText = h3 ? h3.textContent : (h4 ? h4.textContent : el.textContent.substring(0, 30) + '...');
                }

                searchIndex.push({
                    element: el,
                    tabId: tabId,
                    tabLabel: tabLabel,
                    title: titleText.trim(),
                    body: bodyText.trim().replace(/\s+/g, ' '),
                    id: el.id || ''
                });
            });
        }

        // Search Sigla Quick Redirect list
        const quickLinks = {
            'pod': { id: 'sigla-pod', tab: 'core' },
            'vel': { id: 'sigla-vel', tab: 'core' },
            'tec': { id: 'sigla-tec', tab: 'core' },
            'vig': { id: 'sigla-vig', tab: 'core' },
            'ins': { id: 'sigla-ins', tab: 'core' },
            'pv': { id: 'core-resources', tab: 'core' },
            'rk': { id: 'core-resources', tab: 'core' },
            'pa': { id: 'core-combat', tab: 'core' },
            'pt': { id: 'prog-level-calc', tab: 'core' },
            'df': { id: 'core-dice', tab: 'core' }
        };

        const searchField = document.getElementById('search-field');
        const searchClear = document.getElementById('search-clear');
        const resultsPanel = document.getElementById('search-results-panel');
        let searchDebounceTimer = null;

        searchField.addEventListener('input', function() {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
            const query = this.value.trim().toLowerCase();
            
            if (query.length === 0) {
                searchClear.style.display = 'none';
                resultsPanel.style.display = 'none';
                return;
            }

            // Scouter "power up" sweep when the readout panel first opens
            if (resultsPanel.style.display !== 'block') {
                sfxPowerUp();
            }

            searchClear.style.display = 'block';

            // 1. Check for quick links (siglas matching exactly or starts with)
            if (quickLinks[query]) {
                const target = quickLinks[query];
                resultsPanel.innerHTML = `
                    <div class="search-result-item" onclick="navigateToSearchTarget('${target.tab}', '${target.id}')">
                        <div class="result-meta">
                            <span class="result-tab-tag">ATALHO RÁPIDO</span>
                            <span class="result-title">Definição de ${query.toUpperCase()}</span>
                        </div>
                        <div class="result-snippet">Ir direto para a explicação de <strong>${query.toUpperCase()}</strong> na aba Regras Core.</div>
                    </div>
                `;
                resultsPanel.style.display = 'block';
                return;
            }

            if (query.length < 2) {
                resultsPanel.style.display = 'none';
                return;
            }

            // 2. Perform keyword matching
            let matches = [];
            searchIndex.forEach(item => {
                const titleMatch = item.title.toLowerCase().indexOf(query);
                const bodyMatch = item.body.toLowerCase().indexOf(query);

                if (titleMatch !== -1 || bodyMatch !== -1) {
                    let score = 0;
                    if (titleMatch !== -1) score += 100 - titleMatch; // higher score if match is early in title
                    if (bodyMatch !== -1) score += 50 - bodyMatch;

                    // Generate a snippet around the match
                    let snippet = '';
                    const matchIndex = bodyMatch !== -1 ? bodyMatch : 0;
                    const start = Math.max(0, matchIndex - 40);
                    const end = Math.min(item.body.length, matchIndex + 60);
                    snippet = '...' + item.body.substring(start, end) + '...';

                    // Highlight the query in snippet
                    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
                    snippet = snippet.replace(regex, '<mark>$1</mark>');

                    matches.push({
                        item: item,
                        snippet: snippet,
                        score: score
                    });
                }
            });

            // Sort by score descending
            matches.sort((a, b) => b.score - a.score);

            // Render results
            if (matches.length === 0) {
                resultsPanel.innerHTML = `<div class="no-results-item">Nenhum termo encontrado para "${this.value}"</div>`;
            } else {
                resultsPanel.innerHTML = matches.slice(0, 7).map(m => `
                    <div class="search-result-item" onclick="navigateToSearchTarget('${m.item.tabId}', '${m.item.id}')">
                        <div class="result-meta">
                            <span class="result-tab-tag">${m.item.tabLabel}</span>
                            <span class="result-title">${m.item.title}</span>
                        </div>
                        <div class="result-snippet">${m.snippet}</div>
                    </div>
                `).join('');
            }
            resultsPanel.style.display = 'block';
            }, 150);
        });

        searchClear.addEventListener('click', function() {
            sfxClick();
            searchField.value = '';
            this.style.display = 'none';
            resultsPanel.style.display = 'none';
            searchField.focus();
        });

        // Hide search results panel when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchField.contains(e.target) && !resultsPanel.contains(e.target)) {
                resultsPanel.style.display = 'none';
            }
        });

        function escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function navigateToSearchTarget(tabId, elementId) {
            sfxBeep(1200, 0.07, 'square', 0.045);
            // Close search panel
            resultsPanel.style.display = 'none';
            searchField.value = '';
            searchClear.style.display = 'none';

            // Switch to correct tab
            tabSwitch(tabId);

            // Wait a brief moment for tab transitions, then scroll
            setTimeout(() => {
                const targetElement = document.getElementById(elementId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Highlight the card temporarily
                    targetElement.classList.add('search-target-flash');
                    setTimeout(() => {
                        targetElement.classList.remove('search-target-flash');
                    }, 3000);
                }
            }, 100);
        }

        /* ================================================================
           FORJA DE TÉCNICAS AUTORAIS — LOGIC MODULE
           ================================================================ */

        let forjaState = {
            nome: '',
            descricao: '',
            natureza: 'energia',
            atributo: 'tec',
            custoClass: 'medio',
            custoRK: 4,
            efeito: 'nenhum'
        };

        const forjaAttributesByNature = {
            fisica: [
                { value: 'pod', label: 'PODER [POD]' },
                { value: 'vig', label: 'VIGOR [VIG]' }
            ],
            energia: [
                { value: 'tec', label: 'TÉCNICA [TEC]' }
            ],
            espiritual: [
                { value: 'tec', label: 'TÉCNICA [TEC]' },
                { value: 'ins', label: 'INSTINTO [INS]' }
            ]
        };

        const forjaEfeitoInfos = {
            nenhum: {
                nome: 'Nenhum',
                desc: 'Sem efeitos especiais adicionais.'
            },
            perfuracao: {
                nome: 'Perfuração',
                desc: 'Ignora metade do VIGOR (defesa) do alvo. Requer 1 turno de carga preparatória.'
            },
            explosao: {
                nome: 'Explosão',
                desc: 'Causa 25% de dano mesmo se o alvo conseguir esquivar com sucesso.'
            },
            paralisia: {
                nome: 'Paralisia (Stun)',
                desc: 'Se o usuário vencer o teste de acerto, o oponente perde seus Pontos de Ação (PA) na rodada seguinte.'
            },
            rastreador: {
                nome: 'Rastreador',
                desc: 'Rola o teste de acerto com Vantagem.'
            },
            multiplier: {
                nome: 'Multiplier (Buff)',
                desc: 'Aumenta temporariamente o seu Nível Oculto (Output de dano) em +1.'
            }
        };

        function initForjaTab() {
            // Populate key attributes based on default energy type
            updateForjaNatureza('energia', false); 
            renderForjaPreview();
        }

        function updateForjaState(field, val) {
            forjaState[field] = val;
            renderForjaPreview();
        }

        function updateForjaNatureza(natureza, triggerRender = true) {
            sfxClick();
            forjaState.natureza = natureza;

            // Populate key attributes select element
            const selectAttr = document.getElementById('tech-atributo');
            if (selectAttr) {
                selectAttr.innerHTML = '';
                const attrs = forjaAttributesByNature[natureza] || [];
                attrs.forEach(attr => {
                    const opt = document.createElement('option');
                    opt.value = attr.value;
                    opt.textContent = attr.label;
                    selectAttr.appendChild(opt);
                });
                // Set default key attribute for this nature
                forjaState.atributo = attrs[0]?.value || 'tec';
                selectAttr.value = forjaState.atributo;
            }

            // Aura color changes for visual feedback
            const glowColors = {
                fisica: 'rgba(255, 59, 48, 0.2)', // red-ish
                energia: 'rgba(255, 107, 26, 0.2)', // gold/orange
                espiritual: 'rgba(199, 125, 255, 0.22)' // purple
            };
            const rawColors = {
                fisica: 'var(--color-pod)',
                energia: 'var(--color-ki-gold)',
                espiritual: 'var(--color-ins)'
            };

            const card = document.getElementById('forja-preview');
            if (card) {
                card.style.setProperty('--tech-nature-color', rawColors[natureza]);
                card.style.setProperty('--tech-aura-glow', glowColors[natureza]);
            }

            if (triggerRender) {
                renderForjaPreview();
            }
        }

        function updateForjaCustoClass(custoClass) {
            sfxClick();
            forjaState.custoClass = custoClass;

            const rkInput = document.getElementById('tech-custo-rk');
            if (rkInput) {
                // Set defaults and bounds based on classification
                if (custoClass === 'baixo') {
                    rkInput.min = 1;
                    rkInput.max = 2;
                    rkInput.value = 2;
                } else if (custoClass === 'medio') {
                    rkInput.min = 3;
                    rkInput.max = 5;
                    rkInput.value = 4;
                } else if (custoClass === 'proibido') {
                    rkInput.min = 6;
                    rkInput.removeAttribute('max');
                    rkInput.value = 6;
                }
                forjaState.custoRK = parseInt(rkInput.value);
            }

            renderForjaPreview();
        }

        function updateForjaCustoRK(custoRK) {
            let val = parseInt(custoRK);
            const rkInput = document.getElementById('tech-custo-rk');
            if (!rkInput) return;
            
            if (isNaN(val)) val = 1;
            
            // Constrain value to match selection
            if (forjaState.custoClass === 'baixo') {
                if (val < 1) val = 1;
                if (val > 2) val = 2;
            } else if (forjaState.custoClass === 'medio') {
                if (val < 3) val = 3;
                if (val > 5) val = 5;
            } else if (forjaState.custoClass === 'proibido') {
                if (val < 6) val = 6;
            }

            rkInput.value = val;
            forjaState.custoRK = val;
            renderForjaPreview();
        }

        function renderForjaPreview() {
            const titleEl = document.getElementById('preview-tech-title');
            const natureEl = document.getElementById('preview-tech-nature-label');
            const attrEl = document.getElementById('preview-tech-val-atributo');
            const badgeCustoEl = document.getElementById('preview-tech-badge-custo');
            const valCustoEl = document.getElementById('preview-tech-val-custo');
            const valDanoEl = document.getElementById('preview-tech-val-dano');
            const efNameEl = document.getElementById('preview-tech-efeito-name');
            const efDescEl = document.getElementById('preview-tech-efeito-desc');
            const descEl = document.getElementById('preview-tech-description');

            if (titleEl) titleEl.innerText = forjaState.nome.trim() || 'Nova Técnica';
            if (natureEl) natureEl.innerText = forjaState.natureza.toUpperCase();
            
            // Key attribute label mapping
            const attrLabels = {
                pod: 'PODER [POD]',
                vel: 'VELOCIDADE [VEL]',
                tec: 'TÉCNICA [TEC]',
                vig: 'VIGOR [VIG]',
                ins: 'INSTINTO [INS]'
            };
            if (attrEl) attrEl.innerText = attrLabels[forjaState.atributo] || 'TÉCNICA [TEC]';
            
            // Cost & Damage calculations
            const custoClassDisplay = {
                baixo: 'Baixo Custo',
                medio: 'Médio Custo',
                proibido: 'Proibido / Final'
            };
            const danoBaseDisplay = {
                baixo: '5 por sucesso',
                medio: '10 por sucesso',
                proibido: '20 por sucesso'
            };

            if (badgeCustoEl) badgeCustoEl.innerText = custoClassDisplay[forjaState.custoClass];
            if (valCustoEl) valCustoEl.innerText = `${forjaState.custoRK} + 1d4 RK`;
            if (valDanoEl) valDanoEl.innerText = danoBaseDisplay[forjaState.custoClass];

            // Efeito especial
            const ef = forjaEfeitoInfos[forjaState.efeito] || forjaEfeitoInfos.nenhum;
            if (efNameEl) efNameEl.innerText = ef.nome;
            if (efDescEl) efDescEl.innerText = ef.desc;

            // Description
            if (descEl) descEl.innerText = forjaState.descricao.trim() || 'Escreva a descrição no formulário para detalhar sua técnica...';
        }

        /* --- EXPORT FUNCTIONS --- */
        function exportTechTXT() {
            sfxBeep(1200, 0.1, 'sine', 0.05);

            const title = forjaState.nome.trim() || 'Técnica Sem Nome';
            const natureza = forjaState.natureza.toUpperCase();
            
            const attrLabels = {
                pod: 'PODER [POD]',
                vel: 'VELOCIDADE [VEL]',
                tec: 'TÉCNICA [TEC]',
                vig: 'VIGOR [VIG]',
                ins: 'INSTINTO [INS]'
            };
            const atributoLabel = attrLabels[forjaState.atributo] || 'TÉCNICA [TEC]';
            
            const custoClassLabel = {
                baixo: 'Baixo Custo (1-2 RK)',
                medio: 'Médio Custo (3-5 RK)',
                proibido: 'Proibido/Final (6+ RK)'
            }[forjaState.custoClass];

            const danoBase = {
                baixo: '5 de dano base por sucesso',
                medio: '10 de dano base por sucesso',
                proibido: '20 de dano base por sucesso'
            }[forjaState.custoClass];

            const ef = forjaEfeitoInfos[forjaState.efeito] || forjaEfeitoInfos.nenhum;
            const descricao = forjaState.descricao.trim() || 'Sem descrição fornecida.';

            const txtContent = `===============================================================================
                       HIKARETEKU RPG — FORJA DE TÉCNICAS
===============================================================================

NOME DA TÉCNICA: ${title}
NATUREZA:        ${natureza}
ATRIBUTO CHAVE:  ${atributoLabel}

CUSTO DE ENERGIA: ${custoClassLabel} -> ${forjaState.custoRK} + 1d4 RK
RENDIMENTO/DANO:  ${danoBase}

EFEITO ESPECIAL:  ${ef.nome}
                  (${ef.desc})

-------------------------------------------------------------------------------
DESCRIÇÃO / LORE DA TÉCNICA:
-------------------------------------------------------------------------------
${descricao}

-------------------------------------------------------------------------------
Regras de Output: O dano calculado (Sucessos do teste x Dano Base) deve ser 
multiplicado pelo Nível Oculto do guerreiro no momento do impacto.
===============================================================================`;

            const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_tecnica.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function exportTechPDF() {
            sfxPowerLevelAlert();

            // Visual feedback glow on the card
            const card = document.getElementById('forja-preview');
            if (card) {
                card.classList.remove('power-surge');
                void card.offsetWidth; // trigger reflow
                card.classList.add('power-surge');
            }

            // Print after audio/visual effect completes
            setTimeout(() => window.print(), sfxEnabled ? 350 : 0);
        }

        /* --- INITIALIZATION --- */
        window.addEventListener('DOMContentLoaded', () => {
            populateLevelTable();
            initTransformacoesTab();
            buildSearchIndex();
            selectBreed('humano'); // Default species selection
            renderAttributesPointBuy();
            initForjaTab();
        });

        /* --- MESTRAR KEY SEQUENCE TRIGGER --- */
        let mestreTypedSequence = '';
        const mestreTriggerWord = 'MESTRAR';

        document.addEventListener('keydown', (e) => {
            // Check if user is typing in a text field
            const active = document.activeElement;
            if (active && (
                active.tagName === 'INPUT' || 
                active.tagName === 'TEXTAREA' || 
                active.hasAttribute('contenteditable') ||
                active.isContentEditable
            )) {
                return; // ignore keystroke
            }

            // Append standard keys (ignore control keys like Shift, Control, etc.)
            if (e.key && e.key.length === 1) {
                mestreTypedSequence += e.key.toUpperCase();
                // Keep only the length of the trigger word
                if (mestreTypedSequence.length > mestreTriggerWord.length) {
                    mestreTypedSequence = mestreTypedSequence.slice(-mestreTriggerWord.length);
                }
                
                if (mestreTypedSequence === mestreTriggerWord) {
                    mestreTypedSequence = ''; // clear buffer
                    showMestreLogin();
                }
            }
        });

        function showMestreLogin() {
            sfxBeep(600, 0.15, 'sawtooth', 0.06);
            setTimeout(() => sfxBeep(1200, 0.2, 'sawtooth', 0.05), 100);

            const modal = document.getElementById('mestre-login-modal');
            const passInput = document.getElementById('mestre-pass-input');
            const msgEl = document.getElementById('mestre-login-msg');

            if (modal && passInput) {
                modal.style.display = 'flex';
                passInput.value = '';
                if (msgEl) {
                    msgEl.className = 'terminal-msg';
                    msgEl.innerText = '';
                }
                passInput.focus();

                // Add enter key listener to the password field once
                if (!passInput.dataset.hasListener) {
                    passInput.dataset.hasListener = 'true';
                    passInput.addEventListener('keydown', (evt) => {
                        if (evt.key === 'Enter') {
                            validateMestrePassword();
                        }
                    });
                }
            }
        }

        function closeMestreLogin() {
            sfxClick();
            const modal = document.getElementById('mestre-login-modal');
            if (modal) {
                modal.style.display = 'none';
            }
        }

        function validateMestrePassword() {
            const passInput = document.getElementById('mestre-pass-input');
            const msgEl = document.getElementById('mestre-login-msg');

            if (!passInput || !msgEl) return;

            const typedPass = passInput.value;

            if (typedPass === 'Hikareteku123') {
                sfxPowerLevelAlert();
                msgEl.className = 'terminal-msg success';
                msgEl.innerText = 'AUTENTICADO COM SUCESSO. INGRESSANDO...';

                setTimeout(() => {
                    closeMestreLogin();
                    // Swap views
                    const appContainer = document.getElementById('app-container');
                    const mestreContainer = document.getElementById('mestre-container');
                    
                    if (appContainer) appContainer.style.display = 'none';
                    if (mestreContainer) {
                        mestreContainer.style.display = 'block';
                        initMestreDashboard();
                    }
                }, 1000);
            } else {
                sfxBeep(150, 0.4, 'sawtooth', 0.08); // low error buzz
                msgEl.className = 'terminal-msg error';
                msgEl.innerText = 'ACESSO NEGADO. RASTREANDO IP...';
                passInput.value = '';
                passInput.focus();

                // Trigger a temporary shake effect on the dialog
                const dialog = document.querySelector('.terminal-dialog');
                if (dialog) {
                    dialog.style.animation = 'none';
                    void dialog.offsetWidth; // trigger reflow
                    dialog.style.animation = 'terminal-shake 0.3s ease-in-out';
                }
            }
        }

        let mestreLogCount = 0;
        let mestreGroups = [];
        let mestreEnemies = [];

        const physTechNames = [
            "Impacto Esmagador", "Chute Sônico", "Punho Quebra-Ossos", "Furacão Marcial",
            "Combo Veloz", "Giro Brutal", "Carga Terrestre", "Golpe de Misericórdia",
            "Martelo de Ferro", "Impacto Sísmico"
        ];
        
        const kiTechNames = [
            "Lampejo de Ki", "Esfera de Energia", "Raio Cortante", "Explosão Espiritual",
            "Onda de Choque", "Chama Residual", "Disparo Rápido", "Gêiser de Energia",
            "Cúpula de Ki", "Lampejo Estelar"
        ];

        function initMestreDashboard() {
            mestreClearLog();
            
            // Update time clock
            updateMestreClock();
            if (window.mestreClockInterval) clearInterval(window.mestreClockInterval);
            window.mestreClockInterval = setInterval(updateMestreClock, 1000);

            mestreWriteLog('SYSTEM', 'Inicializando Term-OS v1.3...', 'system');
            setTimeout(() => mestreWriteLog('SYSTEM', 'Link de comunicações: ATIVO.', 'system'), 200);
            setTimeout(() => mestreWriteLog('SYSTEM', 'Scanner de Scouter online na frequência local.', 'system'), 400);
            setTimeout(() => mestreWriteLog('SYSTEM', 'Pronto para monitorar simulação de combate.', 'system'), 600);

            renderMestreGroups();
            renderMestreEnemies();
        }

        function updateMestreClock() {
            const clockEl = document.getElementById('mestre-system-time');
            if (clockEl) {
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
                clockEl.innerText = `${dateStr} ${timeStr}`;
            }
        }

        function mestreWriteLog(tag, message, tagClass = 'system') {
            const outputEl = document.getElementById('mestre-console-output');
            if (outputEl) {
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

                const line = document.createElement('div');
                line.className = 'console-line';
                line.innerHTML = `
                    <span class="c-time">[${timeStr}]</span>
                    <span class="c-tag ${tagClass}">${tag}</span>
                    <span class="c-text">${message}</span>
                `;
                outputEl.prepend(line);
                outputEl.scrollTop = 0;
            }
        }

        function mestreClearLog() {
            sfxClick();
            const outputEl = document.getElementById('mestre-console-output');
            if (outputEl) {
                outputEl.innerHTML = '';
            }
        }

        function logoutMestre() {
            sfxBeep(900, 0.08, 'sawtooth', 0.05);
            setTimeout(() => sfxBeep(450, 0.12, 'sawtooth', 0.05), 80);

            if (window.mestreClockInterval) clearInterval(window.mestreClockInterval);
            
            const appContainer = document.getElementById('app-container');
            const mestreContainer = document.getElementById('mestre-container');
            
            if (mestreContainer) mestreContainer.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';
        }

        /* --- GROUP MANAGEMENT LOGIC --- */
        function mestreCreateGroup() {
            sfxBeep(1200, 0.1, 'sine', 0.05);

            const nameInput = document.getElementById('group-new-name');
            const rewardInput = document.getElementById('group-new-reward');

            if (!rewardInput) return;

            let name = nameInput ? nameInput.value.trim() : "";
            if (!name) {
                name = `Grupo ${mestreGroups.length + 1}`;
            }

            const rewardDice = rewardInput.value;

            const newGroup = {
                id: 'group-' + Date.now(),
                name: name,
                rewardDice: rewardDice,
                collapsed: false
            };

            mestreGroups.push(newGroup);

            mestreWriteLog('GRUPO', `Novo grupo de combate "${name}" registrado [Recompensa: ${rewardDice} PT].`, 'system');

            if (nameInput) nameInput.value = '';
            
            renderMestreGroups();
            renderMestreEnemies();
        }

        function mestreDeleteGroup(groupId) {
            sfxBeep(600, 0.1, 'sawtooth', 0.05);
            
            const group = mestreGroups.find(g => g.id === groupId);
            if (!group) return;

            mestreGroups = mestreGroups.filter(g => g.id !== groupId);

            mestreEnemies.forEach(e => {
                if (e.groupId === groupId) {
                    e.groupId = null;
                }
            });

            mestreWriteLog('GRUPO', `Grupo "${group.name}" desfeito. Integrantes agora estão sem grupo.`, 'system');

            renderMestreGroups();
            renderMestreEnemies();
        }

        function mestreToggleGroupCollapse(groupId) {
            const group = mestreGroups.find(g => g.id === groupId);
            if (group) {
                group.collapsed = !group.collapsed;
                renderMestreGroups();
            }
        }

        function mestreRollGroupReward(groupId) {
            sfxPowerUp();
            
            const group = mestreGroups.find(g => g.id === groupId);
            if (!group) return;

            const dieSize = parseInt(group.rewardDice.replace('1d', ''));
            const rollResult = Math.floor(Math.random() * dieSize) + 1;

            mestreWriteLog('RECOMPENSA', `Treinamento finalizado para "${group.name}". Recompensa de Treino rola ${group.rewardDice} -> [ **${rollResult} PT** ] concedidos aos vencedores!`, 'roll');
        }

        /* --- SUB-ABAS DO GERADOR --- */
        function switchMestreGenTab(tabName) {
            sfxClick();
            
            const tabCapanga = document.getElementById('mestre-gen-capanga');
            const tabBoss = document.getElementById('mestre-gen-boss');
            const btnCapanga = document.getElementById('mestre-btn-gen-capanga');
            const btnBoss = document.getElementById('mestre-btn-gen-boss');
            
            if (!tabCapanga || !tabBoss || !btnCapanga || !btnBoss) return;
            
            if (tabName === 'capanga') {
                tabCapanga.style.display = 'block';
                tabBoss.style.display = 'none';
                btnCapanga.classList.add('active');
                btnBoss.classList.remove('active');
            } else if (tabName === 'boss') {
                tabCapanga.style.display = 'none';
                tabBoss.style.display = 'block';
                btnCapanga.classList.remove('active');
                btnBoss.classList.add('active');
            }
        }

        function mestreGenerateBoss() {
            sfxPowerLevelAlert();

            const nameInput = document.getElementById('boss-gen-name');
            const typeInput = document.getElementById('boss-gen-type');
            const levelInput = document.getElementById('boss-gen-level');
            const archetypeInput = document.getElementById('boss-gen-archetype');
            const traitInput = document.getElementById('boss-gen-trait');
            const techInput = document.getElementById('boss-gen-tech');

            if (!levelInput || !archetypeInput || !typeInput || !traitInput) return;

            let name = nameInput ? nameInput.value.trim() : "";
            if (!name) {
                const defaultBossNames = ["Lorde Slug", "Imperador Cooler", "Cyborg 13", "Bojack", "Super Janemba"];
                name = defaultBossNames[Math.floor(Math.random() * defaultBossNames.length)];
            }

            let level = parseInt(levelInput.value);
            if (isNaN(level) || level < 1) level = 1;

            const bossType = typeInput.value;
            const archetype = archetypeInput.value;
            const trait = traitInput.value;

            const baseHP = level * 20 + 30;
            let hpMultiplier = 1.0;
            if (bossType === 'miniboss') hpMultiplier = 2.0;
            else if (bossType === 'boss') hpMultiplier = 3.5;

            const maxHP = Math.floor(baseHP * hpMultiplier);
            const currentHP = maxHP;

            let physMod = 1.0;
            let kiMod = 1.0;
            if (archetype === 'marcial') {
                physMod = 1.75;
            } else if (archetype === 'estrategista') {
                kiMod = 1.75;
            } else if (archetype === 'misto') {
                physMod = 1.40;
                kiMod = 1.40;
            }

            const techniques = [];
            techniques.push({
                name: "Ataque Físico Básico",
                natureza: "fisica",
                baseDamage: 5,
                finalDamage: Math.floor(5 * level * physMod)
            });

            techniques.push({
                name: "Disparo de Ki",
                natureza: "energia",
                baseDamage: 5,
                finalDamage: Math.floor(5 * level * kiMod)
            });

            let customTechName = techInput ? techInput.value.trim() : "";
            if (!customTechName) {
                customTechName = bossType === 'boss' ? "Supernova Devastadora" : "Onda Concentrada de Ki";
            }

            const techNature = archetype === 'marcial' ? 'fisica' : 'energia';
            const techMod = techNature === 'fisica' ? physMod : kiMod;
            techniques.push({
                name: customTechName,
                natureza: techNature,
                baseDamage: 12,
                finalDamage: Math.floor(12 * level * techMod)
            });

            const hasShield = trait === 'barreira';
            const maxShieldHP = 100;
            const shieldHP = hasShield ? maxShieldHP : 0;

            const newBoss = {
                id: 'enemy-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                name: name,
                level: level,
                archetype: archetype,
                maxHP: maxHP,
                currentHP: currentHP,
                groupId: null,
                techniques: techniques,
                isBoss: true,
                bossType: bossType,
                bossTrait: trait,
                phase: 1,
                isEnraged: false,
                hasShield: hasShield,
                shieldHP: shieldHP,
                maxShieldHP: maxShieldHP,
                legendaryTech: customTechName
            };

            mestreEnemies.push(newBoss);

            const bossTitle = bossType === 'boss' ? "BOSS SUPERIOR" : "MINI-BOSS";
            mestreWriteLog('SPAWN', `⚠️ [${bossTitle}] "${name}" [Nível ${level}] convocado com ${maxHP} HP! Habilidade: ${trait.toUpperCase()}`, 'event');

            if (nameInput) nameInput.value = '';
            if (techInput) techInput.value = '';
            levelInput.value = 5;

            renderMestreEnemies();
            renderMestreGroups();
        }

        /* --- ENEMY GENERATION & TRACKING LOGIC --- */
        function mestreGenerateEnemy() {
            sfxBeep(1000, 0.1, 'sine', 0.05);

            const nameInput = document.getElementById('enemy-gen-name');
            const levelInput = document.getElementById('enemy-gen-level');
            const archetypeInput = document.getElementById('enemy-gen-archetype');

            if (!levelInput || !archetypeInput) return;

            let name = nameInput ? nameInput.value.trim() : "";
            if (!name) {
                const defaultNames = ["Capanga de Aluguel", "Guerreiro Mercer", "Recruta Cold", "Sentinela de Ki", "Maroto da Gangue"];
                name = defaultNames[Math.floor(Math.random() * defaultNames.length)] + " " + Math.floor(Math.random() * 100);
            }

            let level = parseInt(levelInput.value);
            if (isNaN(level) || level < 1) level = 1;

            const archetype = archetypeInput.value;
            const maxHP = level * 20 + 30;
            const currentHP = maxHP;

            let physMod = 1.0;
            let kiMod = 1.0;
            if (archetype === 'marcial') {
                physMod = 1.5;
            } else if (archetype === 'estrategista') {
                kiMod = 1.5;
            } else if (archetype === 'misto') {
                physMod = 1.25;
                kiMod = 1.25;
            }

            const techniques = [];
            // Golpe Físico Básico (base 4)
            techniques.push({
                name: "Golpe Básico",
                natureza: "fisica",
                baseDamage: 4,
                finalDamage: Math.floor(4 * level * physMod)
            });

            // Duas técnicas inventadas (base 5 a 10)
            const chosenNames = new Set();
            for (let i = 0; i < 2; i++) {
                const nature = Math.random() > 0.5 ? 'fisica' : 'energia';
                const baseDmg = Math.floor(Math.random() * 6) + 5;
                
                let techName = "";
                const pool = nature === 'fisica' ? physTechNames : kiTechNames;
                do {
                    techName = pool[Math.floor(Math.random() * pool.length)];
                } while (chosenNames.has(techName));
                chosenNames.add(techName);

                const mod = nature === 'fisica' ? physMod : kiMod;
                const finalDmg = Math.floor(baseDmg * level * mod);

                techniques.push({
                    name: techName,
                    natureza: nature,
                    baseDamage: baseDmg,
                    finalDamage: finalDmg
                });
            }

            const newEnemy = {
                id: 'enemy-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                name: name,
                level: level,
                archetype: archetype,
                maxHP: maxHP,
                currentHP: currentHP,
                groupId: null,
                techniques: techniques
            };

            mestreEnemies.push(newEnemy);

            mestreWriteLog('SPAWN', `Inimigo "${name}" [Nível ${level}, ${archetype.toUpperCase()}] entrou em combate com ${maxHP} HP!`, 'event');

            if (nameInput) nameInput.value = '';
            levelInput.value = 1;

            renderMestreEnemies();
            renderMestreGroups();
        }

        function mestreDeleteEnemy(enemyId) {
            sfxBeep(400, 0.1, 'sawtooth', 0.05);
            const enemy = mestreEnemies.find(e => e.id === enemyId);
            if (!enemy) return;

            mestreEnemies = mestreEnemies.filter(e => e.id !== enemyId);
            mestreWriteLog('REMOVER', `Guerreiro "${enemy.name}" removido da simulação.`, 'system');

            renderMestreEnemies();
            renderMestreGroups();
        }

        function mestreUpdateHP(enemyId, action) {
            const enemy = mestreEnemies.find(e => e.id === enemyId);
            if (!enemy) return;

            const inputEl = document.getElementById(`hp-mod-${enemyId}`);
            let amount = inputEl ? parseInt(inputEl.value) : 10;
            if (isNaN(amount) || amount < 1) amount = 1;

            const oldHP = enemy.currentHP;

            if (action === 'damage') {
                sfxBeep(200, 0.2, 'sawtooth', 0.08);

                // If enemy is Boss and has active shield, absorb damage first
                if (enemy.isBoss && enemy.hasShield && enemy.shieldHP > 0) {
                    const absorbed = Math.min(enemy.shieldHP, amount);
                    enemy.shieldHP -= absorbed;
                    amount -= absorbed;
                    mestreWriteLog('ESCUDO', `🛡️ Escudo de Ki absorveu ${absorbed} de dano! (${enemy.shieldHP}/${enemy.maxShieldHP} Shield)`, 'system');
                    if (enemy.shieldHP === 0) {
                        mestreWriteLog('ESCUDO', `💥 Escudo de Ki de "${enemy.name}" colapsou!`, 'event');
                    }
                }

                if (amount > 0) {
                    enemy.currentHP = Math.max(0, enemy.currentHP - amount);
                    const lost = oldHP - enemy.currentHP;
                    mestreWriteLog('DANO', `[HP] ${enemy.name} sofreu -${lost} de dano! (${enemy.currentHP}/${enemy.maxHP} HP)`, 'system');
                    
                    if (enemy.currentHP === 0 && oldHP > 0) {
                        sfxPowerLevelAlert();
                        const defeatTag = enemy.isBoss ? '[CHEFE] ☠️' : '☠️';
                        mestreWriteLog('DERROTA', `${defeatTag} ${enemy.name} foi nocauteado / derrotado em combate!`, 'event');
                    }
                }
            } else if (action === 'heal') {
                sfxBeep(800, 0.15, 'sine', 0.05);
                enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + amount);
                const gained = enemy.currentHP - oldHP;
                mestreWriteLog('CURA', `[HP] ${enemy.name} recuperou +${gained} PV! (${enemy.currentHP}/${enemy.maxHP} HP)`, 'system');
            }

            renderMestreEnemies();
            renderMestreGroups();
        }

        /* --- INTERAÇÕES DE BOSS --- */
        function mestreToggleEnrage(enemyId) {
            const enemy = mestreEnemies.find(e => e.id === enemyId);
            if (!enemy) return;

            enemy.isEnraged = !enemy.isEnraged;
            sfxPowerUp();
            mestreWriteLog('FÚRIA', `🔥 ${enemy.name} ${enemy.isEnraged ? 'entrou em estado de FÚRIA (+50% Dano!)' : 'se acalmou.'}`, 'event');

            renderMestreEnemies();
        }

        function mestreToggleShield(enemyId) {
            const enemy = mestreEnemies.find(e => e.id === enemyId);
            if (!enemy) return;

            enemy.hasShield = !enemy.hasShield;
            if (enemy.hasShield) {
                enemy.shieldHP = enemy.maxShieldHP;
                sfxBeep(900, 0.2, 'sine', 0.06);
                mestreWriteLog('ESCUDO', `🛡️ Escudo de Ki ativado em "${enemy.name}" (${enemy.shieldHP} PV).`, 'system');
            } else {
                enemy.shieldHP = 0;
                sfxBeep(300, 0.15, 'sawtooth', 0.06);
                mestreWriteLog('ESCUDO', `🛡️ Escudo de Ki desativado em "${enemy.name}".`, 'system');
            }

            renderMestreEnemies();
        }

        function mestreTriggerPhase2(enemyId) {
            const enemy = mestreEnemies.find(e => e.id === enemyId);
            if (!enemy || !enemy.isBoss || enemy.phase !== 1) return;

            sfxPowerLevelAlert();
            setTimeout(() => sfxPowerUp(), 300);

            enemy.level += 2;
            enemy.phase = 2;
            enemy.currentHP = enemy.maxHP;

            // Recalculate technique damages for new level
            let physMod = 1.0;
            let kiMod = 1.0;
            if (enemy.archetype === 'marcial') {
                physMod = 1.75;
            } else if (enemy.archetype === 'estrategista') {
                kiMod = 1.75;
            } else if (enemy.archetype === 'misto') {
                physMod = 1.40;
                kiMod = 1.40;
            }

            enemy.techniques.forEach(t => {
                const mod = t.natureza === 'fisica' ? physMod : kiMod;
                t.finalDamage = Math.floor(t.baseDamage * enemy.level * mod);
            });

            mestreWriteLog('FASE 2', `⚠️ TRANSFORMAÇÃO: "${enemy.name}" despertou seu Poder Oculto! Avançou para a FASE 2 (+2 Níveis, HP regenerado ao máximo)!`, 'event');

            renderMestreEnemies();
        }

        function mestreTriggerBossUltimate(enemyId) {
            const enemy = mestreEnemies.find(e => e.id === enemyId);
            if (!enemy) return;

            sfxPowerUp();

            const count = enemy.level + 2;
            let rolls = [];
            let successes = 0;
            let explosions = 0;

            const explodeThreshold = enemy.bossTrait === 'explosao' ? 9 : 10;

            for (let i = 0; i < count; i++) {
                let roll = Math.floor(Math.random() * 10) + 1;
                rolls.push(roll);
                if (roll >= 7) successes++;

                let currentRoll = roll;
                while (currentRoll >= explodeThreshold) {
                    explosions++;
                    let extra = Math.floor(Math.random() * 10) + 1;
                    rolls.push(`(${extra})`);
                    if (extra >= 7) successes++;
                    currentRoll = extra;
                }
            }

            let archetypeMod = 1.0;
            if (enemy.archetype === 'marcial' || enemy.archetype === 'misto') archetypeMod = 1.4;
            else archetypeMod = 1.75;

            if (enemy.isEnraged) archetypeMod *= 1.5;

            const totalDamage = Math.floor(successes * 12 * archetypeMod);

            const rollsStr = rolls.join(', ');
            let desc = `💥 ATAQUE SUPREMO: "${enemy.name}" disparou "${enemy.legendaryTech}"! Rolou ${count} d10 [ ${rollsStr} ] -> **${successes} SUCESSOS**! Dano causado no grupo: [ **${totalDamage}** ]`;
            if (explosions > 0) {
                desc += ` (Explosão de Ki lendária ${explosions}x!)`;
            }

            mestreWriteLog('SUPREMO', desc, 'event');
        }

        function mestreAssignEnemyGroup(enemyId, groupId) {
            const enemy = mestreEnemies.find(e => e.id === enemyId);
            if (!enemy) return;

            const oldGroupId = enemy.groupId;
            enemy.groupId = groupId || null;

            if (groupId) {
                const group = mestreGroups.find(g => g.id === groupId);
                if (group) {
                    mestreWriteLog('GRUPO', `Guerreiro "${enemy.name}" designado para o grupo "${group.name}".`, 'system');
                }
            } else {
                if (oldGroupId) {
                    const oldGroup = mestreGroups.find(g => g.id === oldGroupId);
                    const oldGroupName = oldGroup ? oldGroup.name : "grupo";
                    mestreWriteLog('GRUPO', `Guerreiro "${enemy.name}" removido do grupo "${oldGroupName}".`, 'system');
                }
            }

            renderMestreEnemies();
            renderMestreGroups();
        }

        /* --- RENDERING ENGINES --- */
        function renderMestreGroups() {
            const listEl = document.getElementById('mestre-groups-list');
            if (!listEl) return;

            if (mestreGroups.length === 0) {
                listEl.innerHTML = `<p class="empty-msg" style="color: var(--color-soft-text); font-style: italic; font-size: 0.75rem; text-align: center; margin-top: 1rem;">Nenhum grupo cadastrado.</p>`;
                return;
            }

            listEl.innerHTML = mestreGroups.map(group => {
                const members = mestreEnemies.filter(e => e.groupId === group.id);
                const collapsedClass = group.collapsed ? 'collapsed' : '';
                const arrow = group.collapsed ? '▶' : '▼';

                let membersListHtml = '';
                if (members.length === 0) {
                    membersListHtml = `<div class="mestre-group-member-item" style="color: var(--color-soft-text); font-style: italic;">Nenhum integrante</div>`;
                } else {
                    membersListHtml = members.map(m => {
                        const isDefeated = m.currentHP <= 0;
                        const percent = m.maxHP > 0 ? (m.currentHP / m.maxHP) * 100 : 0;
                        let hpClass = 'healthy';
                        if (isDefeated) hpClass = 'defeated';
                        else if (percent < 30) hpClass = 'defeated';
                        else if (percent < 70) hpClass = 'injured';

                        const hpStateText = isDefeated ? 'DERROTADO' : `${m.currentHP}/${m.maxHP} PV`;

                        return `
                            <div class="mestre-group-member-item">
                                <span>${m.name}</span>
                                <span class="mestre-group-member-hp ${hpClass}">${hpStateText}</span>
                            </div>
                        `;
                    }).join('');
                }

                return `
                    <div class="mestre-group-item">
                        <div class="mestre-group-header" onclick="mestreToggleGroupCollapse('${group.id}')">
                            <span class="mestre-group-title">
                                <span>${arrow}</span>
                                <strong>${group.name}</strong>
                                <span class="mestre-group-reward-badge">${group.rewardDice}</span>
                            </span>
                            <div class="mestre-group-actions" onclick="event.stopPropagation()">
                                <button class="mestre-group-btn" title="Rolar Recompensa" onclick="mestreRollGroupReward('${group.id}')">🎲 Rolar</button>
                                <button class="mestre-group-btn delete" title="Excluir Grupo" onclick="mestreDeleteGroup('${group.id}')">&times;</button>
                            </div>
                        </div>
                        <div class="mestre-group-members ${collapsedClass}">
                            ${membersListHtml}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderMestreEnemies() {
            const listEl = document.getElementById('mestre-enemies-list');
            if (!listEl) return;

            if (mestreEnemies.length === 0) {
                listEl.innerHTML = `<p class="empty-msg" style="color: var(--color-soft-text); font-style: italic; text-align: center; margin-top: 2rem;">Nenhum capanga ativo no combate.</p>`;
                return;
            }

            listEl.innerHTML = mestreEnemies.map(enemy => {
                const isDefeated = enemy.currentHP <= 0;
                let cardClasses = ['mestre-enemy-card'];
                if (isDefeated) cardClasses.push('is-defeated');
                
                if (enemy.isBoss) {
                    if (enemy.bossType === 'boss') cardClasses.push('is-boss');
                    else if (enemy.bossType === 'miniboss') cardClasses.push('is-miniboss');
                    if (enemy.isEnraged) cardClasses.push('is-enraged');
                }
                
                const percent = enemy.maxHP > 0 ? (enemy.currentHP / enemy.maxHP) * 100 : 0;
                
                let hpColorClass = 'hp-high';
                if (percent < 30) hpColorClass = 'hp-low';
                else if (percent < 70) hpColorClass = 'hp-medium';

                const groupOptions = mestreGroups.map(g => `
                    <option value="${g.id}" ${enemy.groupId === g.id ? 'selected' : ''}>${g.name}</option>
                `).join('');

                const techsHtml = enemy.techniques.map(tech => {
                    const natureBadge = tech.natureza === 'fisica' ? 'FIS' : 'KI';
                    const natureClass = tech.natureza === 'fisica' ? 'fisica' : 'energia';
                    
                    const finalDmg = enemy.isEnraged ? Math.floor(tech.finalDamage * 1.5) : tech.finalDamage;
                    const damageText = enemy.isEnraged ? `${finalDmg} Dano 🔥` : `${finalDmg} Dano`;
                    
                    return `
                        <div class="mestre-enemy-tech-line">
                            <span>${tech.name} <span class="mestre-enemy-tech-type-badge ${natureClass}">${natureBadge}</span></span>
                            <strong>${damageText}</strong>
                        </div>
                    `;
                }).join('');

                let badgeText = `Nível ${enemy.level}`;
                let metaText = enemy.archetype.toUpperCase();
                let traitHtml = '';
                
                if (enemy.isBoss) {
                    if (enemy.bossType === 'boss') {
                        badgeText = `💀 BOSS FASE ${enemy.phase}`;
                        metaText = `CHEFE ${enemy.archetype.toUpperCase()}`;
                    } else {
                        badgeText = `💀 MINI-BOSS`;
                        metaText = `MINI-BOSS ${enemy.archetype.toUpperCase()}`;
                    }
                    
                    const traitLabels = {
                        furia: 'Fase de Fúria',
                        acoes: 'Ações Lendárias',
                        barreira: 'Escudo de Ki',
                        explosao: 'Explosão Suprema'
                    };
                    traitHtml = `<div style="font-size: 0.65rem; color: #C77DFF; font-family: var(--font-mono); margin-top: 0.15rem;">Habilidade: [ ${traitLabels[enemy.bossTrait]} ]</div>`;
                }

                let shieldHtml = '';
                if (enemy.isBoss && enemy.hasShield) {
                    const shieldPercent = (enemy.shieldHP / enemy.maxShieldHP) * 100;
                    shieldHtml = `
                        <div class="mestre-enemy-shield-container">
                            <div class="mestre-enemy-shield-text">
                                <span>ESCUDO DE KI</span>
                                <span>${enemy.shieldHP}/${enemy.maxShieldHP} PV</span>
                            </div>
                            <div class="mestre-enemy-shield-bar-outer">
                                <div class="mestre-enemy-shield-bar-inner" style="width: ${shieldPercent}%;"></div>
                            </div>
                        </div>
                    `;
                }

                let bossActionsHtml = '';
                if (enemy.isBoss) {
                    bossActionsHtml = `
                        <div class="mestre-boss-actions-row" style="display: flex; gap: 0.35rem; margin-top: 0.6rem; border-top: 1px dashed rgba(255, 255, 255, 0.08); padding-top: 0.5rem; flex-wrap: wrap;">
                            ${enemy.bossType === 'boss' && enemy.phase === 1 ? `<button class="btn-primary mestre-btn-sm" style="background: rgba(199, 125, 255, 0.1); border-color: #C77DFF; color: #C77DFF;" onclick="mestreTriggerPhase2('${enemy.id}')">🌀 Fase 2</button>` : ''}
                            <button class="btn-primary mestre-btn-sm" style="background: ${enemy.isEnraged ? 'rgba(255, 59, 48, 0.25)' : 'rgba(255, 59, 48, 0.1)'}; border-color: #ff3b30; color: #ff3b30; ${enemy.isEnraged ? 'box-shadow: 0 0 6px #ff3b30;' : ''}" onclick="mestreToggleEnrage('${enemy.id}')">🔥 Fúria</button>
                            <button class="btn-primary mestre-btn-sm" style="background: ${enemy.hasShield ? 'rgba(57, 223, 255, 0.25)' : 'rgba(57, 223, 255, 0.1)'}; border-color: #39DFFF; color: #39DFFF; ${enemy.hasShield ? 'box-shadow: 0 0 6px #39DFFF;' : ''}" onclick="mestreToggleShield('${enemy.id}')">🛡️ Escudo</button>
                            <button class="btn-primary mestre-btn-sm" style="background: rgba(255, 107, 26, 0.1); border-color: var(--color-ki-gold); color: var(--color-ki-gold);" onclick="mestreTriggerBossUltimate('${enemy.id}')">💥 Supremo</button>
                        </div>
                    `;
                }

                return `
                    <div class="${cardClasses.join(' ')}">
                        <button class="mestre-enemy-delete-btn" onclick="mestreDeleteEnemy('${enemy.id}')" title="Excluir Inimigo">&times;</button>
                        
                        <div class="mestre-enemy-header">
                            <div class="mestre-enemy-name-row">
                                <span class="mestre-enemy-name">${enemy.name}</span>
                                <span class="mestre-enemy-meta">${metaText}</span>
                                ${traitHtml}
                            </div>
                            <span class="mestre-enemy-badge-level">${badgeText}</span>
                        </div>

                        ${shieldHtml}

                        <div class="mestre-enemy-hp-container">
                            <div class="mestre-enemy-hp-text">
                                <span>PONTOS DE VIDA</span>
                                <span>${enemy.currentHP}/${enemy.maxHP}</span>
                            </div>
                            <div class="mestre-enemy-hp-bar-outer">
                                <div class="mestre-enemy-hp-bar-inner ${hpColorClass}" style="width: ${percent}%;"></div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
                            <label class="form-label" style="font-size: 0.7rem; margin: 0; white-space: nowrap;">Grupo:</label>
                            <select class="form-select mestre-select-sm" style="flex: 1;" onchange="mestreAssignEnemyGroup('${enemy.id}', this.value)">
                                <option value="">Sem Grupo</option>
                                ${groupOptions}
                            </select>
                        </div>

                        <div class="mestre-enemy-techs">
                            ${techsHtml}
                        </div>

                        <div class="mestre-enemy-controls">
                            <input type="number" id="hp-mod-${enemy.id}" class="form-input-text mestre-hp-input" min="1" value="10">
                            <button class="btn-primary mestre-btn-sm" style="background: rgba(255, 59, 48, 0.1); border-color: var(--color-pod); color: var(--color-pod);" onclick="mestreUpdateHP('${enemy.id}', 'damage')">- Dano</button>
                            <button class="btn-primary mestre-btn-sm" style="background: rgba(57, 255, 106, 0.1); border-color: var(--color-readout-green); color: var(--color-readout-green);" onclick="mestreUpdateHP('${enemy.id}', 'heal')">+ Cura</button>
                        </div>

                        ${bossActionsHtml}
                    </div>
                `;
            }).join('');
        }

        /* --- BASIC ROLL & RANDOM EVENT UTILITIES --- */
        function mestreRollDice() {
            sfxPowerUp();

            const countInput = document.getElementById('mestre-dice-count');
            let count = parseInt(countInput ? countInput.value : 5);
            if (isNaN(count) || count < 1) count = 1;
            if (count > 50) count = 50;
            if (countInput) countInput.value = count;

            let rolls = [];
            let successes = 0;
            let explosions = 0;

            for (let i = 0; i < count; i++) {
                let roll = Math.floor(Math.random() * 10) + 1;
                rolls.push(roll);
                if (roll >= 7) successes++;
                
                let currentRoll = roll;
                while (currentRoll === 10) {
                    explosions++;
                    let extra = Math.floor(Math.random() * 10) + 1;
                    rolls.push(`(${extra})`);
                    if (extra >= 7) successes++;
                    currentRoll = extra;
                }
            }

            const rollsStr = rolls.join(', ');
            let desc = `Rolo de ${count} dados. Resultados: [ ${rollsStr} ] -> **${successes} SUCESSOS**`;
            if (explosions > 0) {
                desc += ` (Explosão de Ki detectada ${explosions}x!)`;
            }

            mestreWriteLog('ROLL', desc, 'roll');
        }

        const mestreRandomEventsList = [
            "Tremor cinético detectado. Um Saiyajin está elevando seu Ki a níveis críticos!",
            "Scouters apontam anomalia no céu: Chuva de meteoritos de Katchin chegando.",
            "Um Namekuseijin local concluiu uma meditação, purificando seu Ki ambiente.",
            "Alerta de Combate: Guerreiro utilizou Zanzoken com sucesso. Z-Vanish registrado!",
            "Invasão iminente! Uma nave de patrulha do Império Cold entrou na atmosfera.",
            "Fusão biológica concluída. A Reserva de Ki local oscilou drasticamente.",
            "Atenção: Um feixe de energia residual abriu uma fenda dimensional no cenário.",
            "O mestre convoca um teste de VIGOR contra Fadiga Corporal para todos."
        ];

        function mestreGenerateEvent() {
            sfxBeep(1100, 0.08, 'triangle', 0.05);
            
            const idx = Math.floor(Math.random() * mestreRandomEventsList.length);
            const eventMsg = mestreRandomEventsList[idx];
            
            mestreWriteLog('EVENT', eventMsg, 'event');
        }