# Comparar períodos no Tableau

Extensão de dashboard que permite selecionar dois intervalos de datas independentes
e comparar indicadores no Tableau Desktop ou no Tableau Cloud.

- Seletor de intervalo em calendário com dois meses e atalhos de 7, 15 e 30 dias.
- Layout responsivo para cabeçalhos e barras laterais.
- Títulos, fonte e tamanhos configuráveis.
- Aplicação por planilha com filtros de intervalo existentes ou por parâmetros
  para comparar duas medidas na mesma planilha.

## Testar no Tableau Desktop

Na raiz do projeto, rode o servidor local e mantenha o terminal aberto.

```powershell
py -m http.server 8765 --bind localhost --directory public
```

Em Linux ou macOS, use `python3` no lugar de `py`. Para testar só a interface,
abra a [prévia local](http://localhost:8765/comparar-periodos-0.4.html?preview=1).

No dashboard, arraste **Extensão** da seção **Objetos** e selecione
`comparar-periodos-0.4.trex` em **Acessar extensões locais**. Abra **Configurar**
no menu do objeto para escolher o modo de aplicação.

| Modo | Configuração |
| --- | --- |
| Filtros por planilha | Adicione o campo em **Filtros → Intervalo de datas** e escolha **Somente esta planilha**. Em **Configurar**, vincule a planilha e o campo ao período desejado. |
| Parâmetros do workbook | Escolha quatro parâmetros de data. Veja os [cálculos de exemplo](PARAMETROS.md) para exibir os dois períodos na mesma planilha. |

## Publicar no Tableau Cloud

O projeto inclui um `Dockerfile` para servir a interface com Nginx e um manifesto
de exemplo para a URL HTTPS. Veja o [guia de implantação](DEPLOY.md) para usar
Dokploy e liberar a extensão no site do Tableau Cloud.

## Autor

Yuri Fernando dos Santos, [@fernandoyuri13](https://github.com/fernandoyuri13).

O JavaScript do Tableau é distribuído com a licença original em
[public/TABLEAU-LICENSE.txt](public/TABLEAU-LICENSE.txt).
