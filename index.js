#!/usr/bin/env node
// 使用Node开发命令行工具所执行的JavaScript脚本必须在顶部加入 #!/usr/bin/env node 声明

// console.log('fsmt-cli初始化...');

const fetch = require('node-fetch');
const program = require('commander');
const download = require('download-git-repo');
const inquirer = require('inquirer');
const ora = require('ora');
const chalk = require('chalk');
const packageData = require('./package.json');
const logSymbols = require('log-symbols');
const fs = require('fs');
const path = require('path');

const templates = {
  'antd-pro': {
    owner: 'fluid-dev',
    repo: 'hexo-theme-fluid',
  },
  'umi-hooks': {
    owner: 'chuntungho',
    repo: 'free-mybatis-plugin',
  },
};

(async () => {
  program
    .command('init')
    .argument('[name]', '项目名称')
    .description('初始化项目')

    .helpOption('-h, --help', '查看帮助')
    .action(async name => {
      // 初始化项目
      inquirer
        .prompt([
          ...(name !== null && name !== undefined && name !== ''
            ? []
            : [
                {
                  type: 'input',
                  name: 'projectName',
                  message: '请输入项目名称',
                },
              ]),
          {
            type: 'input',
            name: 'description',
            message: '请输入项目简介',
          },
          {
            type: 'input',
            name: 'author',
            message: '请输入作者名称',
          },
          {
            type: 'list',
            name: 'template',
            message: '选择其中一个作为项目模版',
            choices: Object.keys(templates),
          },
        ])
        .then(async answers => {
          const versions = [];
          const template = templates[answers.template];
          await fetchTags(template, versions);

          // 初始化项目
          inquirer
            .prompt([
              {
                type: 'list',
                name: 'version',
                message: '选择项目模版版本',
                choices: versions,
              },
            ])
            .then(async answers1 => {
              // 把采集到的用户输入的数据解析替换到 package.json 文件中
              const selectedVersion = answers1.version;
              console.log('选择', selectedVersion);
              let url = `https://github.com:${template.owner}/${template.repo}#${selectedVersion}`;
              console.log('url: ', url);
              // initTemplateDefault(answers, url);
            });
        });
    });

  program
    .command('list')
    .argument('[name]', '模版名称')
    .helpOption('-h, --help', '查看帮助')
    .description('查看可用模版列表')
    .action(async name => {
      if (name !== null && name !== undefined && name !== '') {
        if (Object.keys(templates).includes(name)) {
          const versions = [];
          const template = templates[name];
          await fetchTags(template, versions);

          // 查看可用模版列表
          for (let version of versions) {
            console.log(`${version}`);
          }
        } else {
          console.error(logSymbols.error, chalk.red("template name doesn't exists"));
        }
      } else {
        inquirer
          .prompt([
            {
              type: 'list',
              name: 'template',
              message: '选择其中一个项目模版',
              choices: Object.keys(templates),
            },
          ])
          .then(async answers => {
            const versions = [];
            const template = templates[answers.template];
            await fetchTags(template, versions);

            // 查看可用模版列表
            for (let version of versions) {
              console.log(`${version}`);
            }
          });
      }
    });

  program.addHelpCommand('help [command]', '查看帮助');

  program.version(packageData.version, '-v, --version', '查看版本号信息');
  program.showHelpAfterError();
  program.helpOption('-h, --help', '查看帮助');
  program.parse(process.argv);
})();

async function initTemplateDefault(customContent, gitUrl) {
  console.log(chalk.bold.cyan('FsmtCli: ') + 'will creating a new project starter');
  const { projectName = '' } = customContent;

  try {
    await checkName(projectName);
    await downloadTemplate(gitUrl, projectName);
    await changeTemplate(customContent);

    console.log(chalk.green('template download completed'));
    console.log(chalk.bold.cyan('FsmtCli: ') + 'a new project starter is created');

    // 安装依赖
    const command = `cd ${process.cwd()}/${projectName} && npm install`;
    console.log('cmd: ', command);
    install(command);
  } catch (error) {
    console.log(chalk.red(error));
  }
}

// 创建项目前校验是否已存在
function checkName(projectName) {
  return new Promise((resolve, reject) => {
    fs.readdir(process.cwd(), (err, data) => {
      if (err) {
        return reject(err);
      }
      if (data.includes(projectName)) {
        return reject(new Error(`${projectName} already exists!`));
      }
      resolve();
    });
  });
}

function downloadTemplate(gitUrl, projectName) {
  const spinner = ora('download template......').start();

  return new Promise((resolve, reject) => {
    download(gitUrl, path.resolve(process.cwd(), projectName), { clone: true }, function (err) {
      if (err) {
        return reject(err);
        spinner.fail(); // 下载失败提示
      }
      spinner.succeed(); // 下载成功提示
      resolve();
    });
  });
}

async function changeTemplate(customContent) {
  // name description author
  const { projectName = '', description = '', author = '' } = customContent;
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(process.cwd(), projectName, 'package.json'), 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }
      let packageContent = JSON.parse(data);
      packageContent.name = projectName;
      packageContent.author = author;
      packageContent.description = description;
      fs.writeFile(
        path.resolve(process.cwd(), projectName, 'package.json'),
        JSON.stringify(packageContent, null, 2),
        'utf8',
        (err, data) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  });
}

async function fetchTags(template, versions) {
  const spinner = ora('fetching tags...').start();

  await fetch(`https://api.github.com/repos/${template.owner}/${template.repo}/tags`)
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Network response was not ok.');
      spinner.fail(); // 下载失败提示
    })
    .then(tags => {
      versions.push(
        ...tags.map(tag => {
          return tag.name; // 打印每个标签的名称
        })
      );
      spinner.succeed(); // 下载成功提示
    })
    .catch(error => {
      spinner.fail(); // 下载失败提示
      console.error('There was an error fetching the tags:', error);
    });
}

function install(command) {
  const installSpinner = ora(`正在安装依赖, 请耐心等待...`).start();
  const child = exec(command, err => {
    if (err) {
      installSpinner.fail(chalk.red('安装项目依赖失败，请自行重新安装！'));
    } else {
      installSpinner.succeed(chalk.gray('安装成功'));
    }
  });
  child.stdout.on('data', data => {
    installSpinner.stop();
    console.log(data.replace(/\n$/, ''));
    installSpinner.start();
  });
  child.stderr.on('data', data => {
    console.log(data.replace(/\n$/, ''));
    installSpinner.start();
  });
}
