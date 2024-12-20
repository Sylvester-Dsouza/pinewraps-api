import { auth } from '../src/lib/firebase-admin';

const domains = [
  'pinewraps.com',
  'www.pinewraps.com',
  'pinewraps-web.vercel.app',
  'pinewraps-web-git-main.vercel.app',
  'pinewraps-web-git-staging.vercel.app'
];

async function verifyAuthDomains() {
  try {
    console.log('Getting project configuration...');
    const projectConfig = await auth.projectConfigManager().getProjectConfig();
    
    console.log('\nAuthorized Domains:');
    projectConfig.authorizedDomains?.forEach((domain: string) => {
      console.log(`- ${domain}`);
    });

    console.log('\nMissing Domains:');
    domains.forEach(domain => {
      if (!projectConfig.authorizedDomains?.includes(domain)) {
        console.log(`- ${domain}`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

verifyAuthDomains();
