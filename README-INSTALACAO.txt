PAINEL CENTRAL DO WHATSAPP - NETLIFY
====================================

Este projeto usa:
- Netlify Identity para login.
- Netlify Functions para a API.
- Netlify Blobs para salvar número e mensagens.
- Vite apenas para gerar os arquivos estáticos do painel.

1) PUBLICAR PELO GITHUB
-----------------------
1. Crie um repositório novo no GitHub, por exemplo: painel-whatsapp.
2. Envie TODO o conteúdo desta pasta para a raiz do repositório.
3. Na Netlify, clique em Add new project > Import an existing project.
4. Escolha GitHub e selecione o repositório.
5. O arquivo netlify.toml já informa:
   Build command: npm run build
   Publish directory: dist
6. Inicie o deploy.

IMPORTANTE: o deploy manual por arrastar e soltar não instala Functions nem dependências. Para este painel, use GitHub ou Netlify CLI.

2) ATIVAR O LOGIN
-----------------
1. Abra o projeto na Netlify.
2. Vá em Project configuration > Identity.
3. Clique em Enable Identity.
4. Em Registration, selecione Invite only.
5. Em Identity > Users, convide o seu próprio e-mail.
6. Abra o convite recebido e conclua o cadastro da senha.

3) ABRIR O PAINEL
-----------------
Acesse:
https://NOME-DO-SEU-SITE.netlify.app/admin/

Entre com o e-mail convidado e sua senha.
Preencha o número no formato 55 + DDD + número, somente números.
Exemplo: 5511999999999

4) CONECTAR O PLAYSIM
---------------------
Antes de </body> no index.html do PlaySim, use:

<script src="https://NOME-DO-SEU-PAINEL.netlify.app/client/whatsapp.js" data-site="playsim" defer></script>

O script encontra automaticamente links wa.me, wa.link e whatsapp.com.
Se o painel estiver temporariamente indisponível, o link antigo do site permanece como segurança.

5) ADICIONAR OUTROS SITES
-------------------------
No painel, clique em Adicionar site e defina um identificador, por exemplo:
virtualplay
newera
adamplay

No respectivo site, altere data-site:

<script src="https://NOME-DO-SEU-PAINEL.netlify.app/client/whatsapp.js" data-site="virtualplay" defer></script>

6) MENSAGEM DIFERENTE EM UM BOTÃO ESPECÍFICO
---------------------------------------------
Mesmo usando a mensagem central do site, um botão específico pode ter uma mensagem própria:

<a href="https://wa.link/link-antigo" data-whatsapp-message="Olá! Quero solicitar um teste.">Solicitar teste</a>

SEGURANÇA
---------
- Não coloque senha dentro de HTML ou JavaScript.
- Mantenha o Identity em Invite only.
- Use HTTPS, que a Netlify ativa automaticamente.
- Não compartilhe sua conta administrativa.
