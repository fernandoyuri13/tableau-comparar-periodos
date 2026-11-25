# Como comparar dois períodos no Tableau

Use o modo **Atualizar parâmetros do workbook** para comparar o mesmo indicador em dois intervalos de datas na mesma planilha.

## 1. Crie quatro parâmetros

No painel **Dados**, escolha **Criar parâmetro**. Crie os quatro parâmetros abaixo com o tipo **Data** e **Valores permitidos → Todos**. As datas são exemplos.

| Seletor | Data inicial | Data final | Exemplo de intervalo |
| --- | --- | --- | --- |
| Período principal | `p_Data_Inicial` | `p_Data_Final` | 01/11/2026 a 23/11/2026 |
| Período de comparação | `p_Comparacao_Inicial` | `p_Comparacao_Final` | 01/10/2026 a 23/10/2026 |

## 2. Identifique os registros de cada período

Crie dois campos calculados com os nomes abaixo. Substitua `[Data do registro]` pelo campo de data da sua fonte. Os limites são inclusivos. `DATE()` descarta o horário, o que inclui todos os registros do último dia.

**Dentro do período principal**

```tableau
DATE([Data do registro]) >= [p_Data_Inicial]
AND DATE([Data do registro]) <= [p_Data_Final]
```

**Dentro do período de comparação**

```tableau
DATE([Data do registro]) >= [p_Comparacao_Inicial]
AND DATE([Data do registro]) <= [p_Comparacao_Final]
```

## 3. Mostre os dois valores na mesma planilha

Substitua `[Valor]` pelo campo numérico que você quer somar. Crie as duas medidas e adicione ambas à visualização.

**Valor no período principal**

```tableau
SUM(IF [Dentro do período principal] THEN [Valor] END)
```

**Valor no período de comparação**

```tableau
SUM(IF [Dentro do período de comparação] THEN [Valor] END)
```

Se já houver um filtro de data na planilha, confira se ele mantém os registros dos dois intervalos. Para exibir apenas registros que pertencem a pelo menos um deles, crie o campo **Dentro dos períodos selecionados**, arraste-o para **Filtros** e selecione **Verdadeiro**.

```tableau
[Dentro do período principal] OR [Dentro do período de comparação]
```

Para indicadores que dependem de registros anteriores ao intervalo, como saldos acumulados, use os parâmetros na lógica do indicador antes de limitar os registros da planilha.

## 4. Configure a extensão no dashboard

1. Adicione a planilha ao dashboard e insira a extensão. Use o [manifesto da versão hospedada](https://fernandoyuri13.github.io/tableau-comparar-periodos/comparar-periodos-cloud.trex) ou siga as [instruções de instalação local](README.md#testar-no-tableau-desktop).
2. No menu do objeto da extensão, abra **Configurar** e selecione **Atualizar parâmetros do workbook** no campo **Modo de aplicação**.
3. Associe os quatro parâmetros aos campos de início e fim de cada período, conforme a tabela do passo 1.
4. Clique em **Salvar configuração** e salve a pasta de trabalho.
5. Escolha um intervalo em cada seletor e clique em **Aplicar período**. Para verificar o resultado, altere um seletor para um intervalo com registros diferentes e confira se a medida correspondente muda enquanto a do outro período mantém o valor.
