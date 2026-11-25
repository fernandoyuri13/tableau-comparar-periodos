# Publicar o seletor de períodos pelo Dokploy

O projeto inclui um Dockerfile com Nginx e um modelo de manifesto para o Tableau Cloud. Você pode usar um repositório Git como origem no Dokploy ou enviar um ZIP com os arquivos da raiz do projeto.

## 1. Crie a aplicação

No projeto do Dokploy, crie um serviço do tipo **Application**. Na configuração
do serviço, escolha:

| Campo | Valor |
| --- | --- |
| Nome | `tableau-comparar-periodos` |
| Provider | **Drop** |
| Build Type | **Dockerfile** |
| Dockerfile | `Dockerfile` |
| Build Path, se solicitado | `/` |
| Docker Context Path, se solicitado | `.` |

Salve a configuração, envie o ZIP do projeto pelo Drop e inicie a implantação. Caso sua instalação do Dokploy não mostre **Drop**, coloque
os arquivos extraídos na raiz de um repositório Git que você controla e
conecte esse repositório à aplicação com o mesmo Build Type.

## 2. Configure o endereço HTTPS na VPS

No seu provedor de DNS, crie um registro A para um subdomínio que você controla.
Por exemplo, `tableau-ext.seudominio.com.br` apontando para `IP público da VPS`.

Em **Domains → Create Domain**, configure:

| Campo | Valor |
| --- | --- |
| Host | Seu subdomínio, sem protocolo |
| Path | `/` |
| Container Port | `8080` |
| HTTPS | Ativado |
| Certificate | **Let's Encrypt** |

O Traefik do Dokploy encaminha o tráfego ao contêiner. As conexões HTTP e HTTPS
chegam à VPS pelas portas 80 e 443. O link na porta 3000 é do painel
administrativo.

Em uma instalação existente, atualize o **Container Port** de 80 para 8080
ao implantar a nova imagem. O contêiner roda sem root. As portas públicas
80 e 443 continuam no Traefik.

O Nginx permite incorporar a extensão em páginas do mesmo endereço e no
Tableau Cloud em `online.tableau.com`. Para usar um Tableau Server com domínio
próprio ou outro endereço Tableau autorizado, adicione o origin HTTPS exato
à diretiva `frame-ancestors` de `nginx.conf` antes de reconstruir a imagem.

Quando o certificado estiver ativo, teste no navegador:

```text
https://tableau-ext.seudominio.com.br/comparar-periodos-0.4.html?preview=1
```

## 3. Publique no Tableau Cloud

1. No arquivo local `comparar-periodos-cloud.trex`, troque
   `tableau-ext.example.com` pelo subdomínio real. A URL do manifesto deve ser
   HTTPS e terminar em `/comparar-periodos-0.4.html`.
2. No Tableau Cloud, entre em **Configurações → Extensões → Habilitar extensões
   específicas**. Adicione a URL exata que você colocou no .trex e deixe
   **Acesso completo aos dados** como **Negar**.
3. No Tableau Desktop, remova o objeto local da extensão e adicione o .trex
   atualizado. Configure novamente o mapeamento e a aparência do objeto.
4. Use **Servidor → Publicar pasta de trabalho** e valide os dois seletores
   pelo navegador no Tableau Cloud.

O contêiner serve apenas a interface estática. Os parâmetros e os filtros
são aplicados pela API do Tableau, dentro da pasta de trabalho.

## GitHub Pages

O GitHub Pages serve os arquivos estáticos sem passar pelo Nginx. O CSP no
HTML e a política de referrer valem no Pages. A diretiva `frame-ancestors`
precisa de um cabeçalho HTTP, então ela vale apenas na implantação com Nginx.
Antes de atualizar a branch de publicação do Pages, confira a prévia e
teste a abertura do calendário e da configuração dentro do Tableau.
