import {createPullRequest, createBranch, closePullRequest, deleteBranch, assignMemberToPullRequest, resignMemberToPullRequest } from '../src/backend/github.js';
import assert from 'assert';

const GUILD = {
  id: process.env.DISCORD_GUILD_ID
};

const GITHUB = {
  owner: 'jhs232',
  repo: 'P2-Test-Branch',
  title: 'Mocha test pull request',
  head: 'Test',
  base: 'main',
  branchName: 'Mocha-test-branch',
  memberName: 'KristofferHolm01',
  type: 'Assignee',
  assignee: 'KristofferHolm01',
  closed: 'closed'
};

describe('GitHub', function() {
  // Set the execute time limit for each test (in ms)
  this.timeout(10000);
  
  // Test for the createPullRequest function
  describe('CreatePullRequest', function() {
    it('Should create a pull request', async function() {
      const createdPullRequest = await createPullRequest(GITHUB.owner, GITHUB.repo, GITHUB.title, GITHUB.head, GITHUB.base, GUILD.id);

      // Check if the results are correct
      assert.strictEqual(createdPullRequest.head.repo.owner.login, GITHUB.owner);
      assert.strictEqual(createdPullRequest.head.repo.name, GITHUB.repo);
      assert.strictEqual(createdPullRequest.title, GITHUB.title);
      assert.strictEqual(createdPullRequest.head.ref, GITHUB.head);
      assert.strictEqual(createdPullRequest.base.ref, GITHUB.base);
    });
  });
      
  // Test for the assignMemberToPullRequest function
  describe('assignMemberToPullRequest', function() {
    it('Should assign a member to pull request', async function() {
      await assignMemberToPullRequest(GITHUB.owner, GITHUB.repo, GITHUB.title, GITHUB.memberName, GUILD.id, GITHUB.type);
    });
  });
    
  // Test for the resignMemberToPullRequest function
  describe('resignMemberToPullRequest', function() {
    it('Should resign a member to pull request', async function() {
      await resignMemberToPullRequest(GITHUB.owner, GITHUB.repo, GITHUB.title, GITHUB.assignee, GUILD.id, GITHUB.type);
    });
  });
      
  // Test for the deletePullRequest function
  describe('closePullRequest', function() {
    it('Should close a pull request', async function() {
      const closedPullRequest = await closePullRequest(GITHUB.owner, GITHUB.repo, GITHUB.title, GUILD.id);
  
      // Check if the results are correct
      assert.strictEqual(closedPullRequest.head.repo.owner.login, GITHUB.owner);
      assert.strictEqual(closedPullRequest.head.repo.name, GITHUB.repo);
      assert.strictEqual(closedPullRequest.title, GITHUB.title);
      // Check if the pull request got deleted (closed)
      assert.strictEqual(closedPullRequest.state, GITHUB.closed);
    });
  });
          
  // Test for the createBranch function
  describe('createBranch', function() {
    it('Should create a GitHub branch', async function() {
      const createdBranch = await createBranch(GITHUB.owner, GITHUB.repo, GITHUB.branchName, GUILD.id);
      
      // Get the owner, repo, and branchName
      const owner = createdBranch.url.split("/")[4];
      const repo = createdBranch.url.split("/")[5];
      const branchName = createdBranch.url.split("/")[9];

      // Check if the results are correct
      assert.strictEqual(owner, GITHUB.owner);
      assert.strictEqual(repo, GITHUB.repo);
      assert.strictEqual(branchName, GITHUB.branchName);
    });
  });

  // Test for the deleteBranch function
  describe('deleteBranch', function() {
    it('Should delete a GitHub branch', async function() {
      await deleteBranch(GITHUB.owner, GITHUB.repo, GITHUB.branchName, GUILD.id);
    });
  });
});