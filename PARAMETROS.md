# Comparação por parâmetros

## Configure os parâmetros

Use esse modo para comparar as duas medidas na mesma planilha. Em **Configurar**,
escolha os quatro parâmetros de data. Os nomes abaixo são os valores padrão
e podem ser reaproveitados se você já montou o workbook.


Crie os quatro parâmetros abaixo, todos do tipo **Data**, com **Valores permitidos**
em **Todos**. Você pode usar as datas de exemplo na primeira configuração.

| Seletor | Nome do parâmetro | Valor de exemplo |
| --- | --- | --- |
| Principal | `p_Data_Inicial` | 01/11/2026 |
| Principal | `p_Data_Final` | 23/11/2026 |
| Comparação | `p_Comparacao_Inicial` | 01/10/2026 |
| Comparação | `p_Comparacao_Final` | 23/10/2026 |

Crie dois campos calculados. Substitua `[Data do Movimento]` pelo campo de data
da fonte. `DATE()` inclui todo o último dia quando a coluna tem horário.

**Dentro do período principal**

```tableau
DATE([Data do Movimento]) >= [p_Data_Inicial]
AND DATE([Data do Movimento]) <= [p_Data_Final]
```

**Dentro do período de comparação**

```tableau
DATE([Data do Movimento]) >= [p_Comparacao_Inicial]
AND DATE([Data do Movimento]) <= [p_Comparacao_Final]
```

## Mostre os dois valores na mesma planilha

Para comparar um indicador aditivo, como quantidade movimentada, crie uma
medida para cada intervalo e arraste as duas para a visualização. Adapte
`[Quantidade]` ao seu indicador.

**Quantidade no período principal**

```tableau
SUM(IF [Dentro do período principal] THEN [Quantidade] END)
```

**Quantidade no período de comparação**

```tableau
SUM(IF [Dentro do período de comparação] THEN [Quantidade] END)
```

Se você usa os filtros de data atuais nessa planilha, confira se eles mantêm
os registros dos dois intervalos disponíveis. Para mostrar apenas registros
de um intervalo ou do outro, crie um cálculo com a expressão abaixo e filtre
por **Verdadeiro**.

```tableau
[Dentro do período principal] OR [Dentro do período de comparação]
```

Para Embalagens, esse exemplo serve para movimentos aditivos. Saldos de abertura
e fechamento podem depender de registros anteriores ao intervalo. Nesses
indicadores, use os parâmetros nas regras de saldo antes de limitar as linhas.

