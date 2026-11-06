const resources={
  "sms-channels": {
    "title": "短信渠道",
    "permission": "sms-channel",
    "fields": [
      {
        "key": "signature",
        "label": "短信签名",
        "kind": "text",
        "required": true
      },
      {
        "key": "code",
        "label": "渠道编码",
        "kind": "text",
        "required": true
      },
      {
        "key": "status",
        "label": "状态",
        "kind": "status",
        "required": true
      },
      {
        "key": "remark",
        "label": "备注",
        "kind": "textarea",
        "required": false
      },
      {
        "key": "apiKey",
        "label": "API Key（修改留空保留）",
        "kind": "secret",
        "required": true
      },
      {
        "key": "apiSecret",
        "label": "API Secret（修改留空保留）",
        "kind": "secret",
        "required": false
      },
      {
        "key": "callbackUrl",
        "label": "回调地址",
        "kind": "text",
        "required": false
      }
    ]
  },
  "sms-templates": {
    "title": "短信模板",
    "permission": "sms-template",
    "send": "send-sms",
    "fields": [
      {
        "key": "name",
        "label": "模板名称",
        "kind": "text",
        "required": true
      },
      {
        "key": "code",
        "label": "模板编码",
        "kind": "text",
        "required": true
      },
      {
        "key": "type",
        "label": "模板类型（原字典值）",
        "kind": "integer",
        "required": true
      },
      {
        "key": "status",
        "label": "状态",
        "kind": "status",
        "required": true
      },
      {
        "key": "content",
        "label": "模板内容",
        "kind": "textarea",
        "required": true
      },
      {
        "key": "apiTemplateId",
        "label": "服务商模板编号",
        "kind": "text",
        "required": true
      },
      {
        "key": "channelId",
        "label": "短信渠道编号",
        "kind": "id",
        "required": true
      },
      {
        "key": "remark",
        "label": "备注",
        "kind": "textarea",
        "required": false
      }
    ]
  },
  "mail-accounts": {
    "title": "邮件账号",
    "permission": "mail-account",
    "fields": [
      {
        "key": "mail",
        "label": "发件邮箱",
        "kind": "text",
        "required": true
      },
      {
        "key": "username",
        "label": "SMTP用户名",
        "kind": "text",
        "required": true
      },
      {
        "key": "password",
        "label": "SMTP密码（修改留空保留）",
        "kind": "secret",
        "required": true
      },
      {
        "key": "host",
        "label": "SMTP主机",
        "kind": "text",
        "required": true
      },
      {
        "key": "port",
        "label": "SMTP端口",
        "kind": "integer",
        "required": true
      },
      {
        "key": "sslEnable",
        "label": "SSL",
        "kind": "boolean",
        "required": true
      },
      {
        "key": "starttlsEnable",
        "label": "STARTTLS",
        "kind": "boolean",
        "required": true
      }
    ]
  },
  "mail-templates": {
    "title": "邮件模板",
    "permission": "mail-template",
    "send": "send-mail",
    "fields": [
      {
        "key": "name",
        "label": "模板名称",
        "kind": "text",
        "required": true
      },
      {
        "key": "code",
        "label": "模板编码",
        "kind": "text",
        "required": true
      },
      {
        "key": "accountId",
        "label": "发件账号编号",
        "kind": "id",
        "required": true
      },
      {
        "key": "nickname",
        "label": "发件昵称",
        "kind": "text",
        "required": false
      },
      {
        "key": "title",
        "label": "邮件标题",
        "kind": "text",
        "required": true
      },
      {
        "key": "content",
        "label": "邮件内容",
        "kind": "textarea",
        "required": true
      },
      {
        "key": "status",
        "label": "状态",
        "kind": "status",
        "required": true
      },
      {
        "key": "remark",
        "label": "备注",
        "kind": "textarea",
        "required": false
      }
    ]
  },
  "notify-templates": {
    "title": "站内信模板",
    "permission": "notify-template",
    "send": "send-notify",
    "fields": [
      {
        "key": "name",
        "label": "模板名称",
        "kind": "text",
        "required": true
      },
      {
        "key": "code",
        "label": "模板编码",
        "kind": "text",
        "required": true
      },
      {
        "key": "type",
        "label": "模板类型（原字典值）",
        "kind": "integer",
        "required": true
      },
      {
        "key": "nickname",
        "label": "发件昵称",
        "kind": "text",
        "required": true
      },
      {
        "key": "content",
        "label": "模板内容",
        "kind": "textarea",
        "required": true
      },
      {
        "key": "status",
        "label": "状态",
        "kind": "status",
        "required": true
      },
      {
        "key": "remark",
        "label": "备注",
        "kind": "textarea",
        "required": false
      }
    ]
  },
  "social-clients": {
    "title": "社交客户端",
    "permission": "social-client",
    "fields": [
      {
        "key": "name",
        "label": "应用名",
        "kind": "text",
        "required": true
      },
      {
        "key": "socialType",
        "label": "社交平台类型（原枚举值）",
        "kind": "integer",
        "required": true
      },
      {
        "key": "userType",
        "label": "用户类型（1会员/2管理员）",
        "kind": "userType",
        "required": true
      },
      {
        "key": "status",
        "label": "状态",
        "kind": "status",
        "required": true
      },
      {
        "key": "clientId",
        "label": "客户端编号",
        "kind": "text",
        "required": true
      },
      {
        "key": "clientSecret",
        "label": "客户端密钥（修改留空保留）",
        "kind": "secret",
        "required": true
      },
      {
        "key": "agentId",
        "label": "应用Agent编号",
        "kind": "text",
        "required": false
      }
    ]
  },
  "sms-logs": {
    "title": "短信发送记录",
    "permission": "sms-log",
    "readonly": true,
    "fields": []
  },
  "mail-logs": {
    "title": "邮件发送记录",
    "permission": "mail-log",
    "readonly": true,
    "fields": []
  },
  "notify-messages": {
    "title": "站内信记录",
    "permission": "notify-message",
    "readonly": true,
    "fields": []
  },
  "social-users": {
    "title": "社交用户",
    "permission": "social-user",
    "readonly": true,
    "fields": []
  }
}
function resource(key){if(!Object.hasOwn(resources,key))throw Error('不支持的模块');return resources[key]}
function initial(key,row={}){const result={};for(const f of resource(key).fields){let v=row[f.key];if(f.kind==='secret')v='';else if(f.kind==='list'&&Array.isArray(v))v=v.join('\n');if(v==null)v=['integer','status'].includes(f.kind)?'0':f.kind==='boolean'?'false':f.kind==='userType'?'2':'';result[f.key]=String(v)}return result}
function payload(key,input,edit){const result={};for(const f of resource(key).fields){let v=String(input[f.key]==null?'':input[f.key]);if(f.kind!=='secret')v=v.trim();if(f.required&&!v&&!(edit&&f.kind==='secret'))throw Error('请填写'+f.label);if(v.length>10000)throw Error(f.label+'过长');if(f.kind==='integer'){if(!/^\d{1,9}$/.test(v))throw Error(f.label+'须为非负整数');v=Number(v)}else if(f.kind==='id'){if(!/^[1-9]\d{0,18}$/.test(v))throw Error(f.label+'格式无效')}else if(f.kind==='boolean'){if(!['true','false'].includes(v))throw Error('请选择开关');v=v==='true'}else if(f.kind==='status'||f.kind==='userType'){if(!(f.kind==='status'?['0','1']:['1','2']).includes(v))throw Error(f.label+'无效');v=Number(v)}else if(f.kind==='list'){v=v?v.split(/\n/).map(x=>x.trim()).filter(Boolean):[];if(v.length>100||new Set(v).size!==v.length)throw Error(f.label+'重复或过多')}result[f.key]=v}return result}
export {resources,resource,initial,payload}
