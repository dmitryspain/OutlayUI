import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { environment as mobile } from '../../environments/environment.mobile';
import { API_BASE_URL } from './config';

describe('API_BASE_URL', () => {
  it('is the address of the build environment (unit tests run the web one)', () => {
    expect(environment.name).toBe('web');
    expect(TestBed.inject(API_BASE_URL)).toBe(environment.apiBaseUrl);
  });

  it('is read from the environment, not hard-coded: another address there is another backend', () => {
    const web = environment.apiBaseUrl;
    environment.apiBaseUrl = 'https://mac.tailnet.ts.net/api'; // what the mobile build's file replacement amounts to
    try {
      expect(TestBed.inject(API_BASE_URL)).toBe('https://mac.tailnet.ts.net/api');
    } finally {
      environment.apiBaseUrl = web;
    }
  });
});

describe('build environments', () => {
  it('the mobile one has the same fields as the web one and calls itself "mobile"', () => {
    expect(Object.keys(mobile).sort()).toEqual(Object.keys(environment).sort());
    expect(mobile.name).toBe('mobile');
  });

  it('API addresses end in /api with no trailing slash (the services append "/clients/cards"); iOS allows only https', () => {
    for (const env of [environment, mobile]) {
      expect(env.apiBaseUrl).withContext(env.name).toMatch(/^https?:\/\/[^/]+\/(?:.+\/)?api$/);
    }
    expect(mobile.apiBaseUrl).toMatch(/^https:\/\//);
  });
});
