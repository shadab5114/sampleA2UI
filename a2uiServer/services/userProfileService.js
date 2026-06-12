export function handleUserProfileService(userId, tab, isUiMode) {
  userId = userId || 'USR-12345';
  tab = tab || 'Overview';

  const textResult = `Profile for user: ${userId} (${tab} section)`;

  if (isUiMode) {
    return createProfileUI(userId, tab);
  } else {
    return { text: textResult };
  }
}

function createProfileUI(userId, activeTab) {
  const surfaceId = 'user_profile';
  const rootId = 'root';
  
  const tabs = ["Overview", "Activity", "Settings", "Security"];
  
  const childIds = [
    "header", "user_id_display", "divider1", "tab_nav_title"
  ];
  
  for (let i = 0; i < tabs.length; i++) {
    childIds.push(`tab_${i}_button`);
  }
  
  childIds.push("divider2", "content_title");
  
  const tabNormal = activeTab.toLowerCase();
  if (tabNormal === 'overview') {
    childIds.push("overview_name", "overview_email", "overview_joined", "overview_role", "overview_status");
  } else if (tabNormal === 'activity') {
    childIds.push("activity_title", "activity_1", "activity_2", "activity_3", "activity_4");
  } else if (tabNormal === 'settings') {
    childIds.push("settings_notifications", "settings_privacy", "settings_language", "settings_timezone");
  } else if (tabNormal === 'security') {
    childIds.push("security_password", "security_2fa", "security_sessions", "security_devices");
  }

  const components = [
    {
      id: rootId,
      component: {
        Column: {
          children: { explicitList: childIds }
        }
      }
    },
    {
      id: "header",
      component: { Text: { text: { literalString: "👤 User Profile" }, usageHint: "h1" } }
    },
    {
      id: "user_id_display",
      component: { Text: { text: { literalString: `User ID: ${userId}` }, usageHint: "h3" } }
    },
    {
      id: "divider1",
      component: { Text: { text: { literalString: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" }, usageHint: "body" } }
    },
    {
      id: "tab_nav_title",
      component: { Text: { text: { literalString: "📑 Profile Sections:" }, usageHint: "h2" } }
    }
  ];

  const dataModel = [
    { key: "profile", valueMap: [
      { key: "userId", valueString: userId }
    ] }
  ];

  tabs.forEach((tabName, i) => {
    const tabKey = `tab${i}`;
    const isActive = tabName.toLowerCase() === activeTab.toLowerCase();
    const indicator = isActive ? "▶ " : "  ";
    const emphasis = isActive ? " [Active]" : "";

    components.push(
      {
        id: `tab_${i}_text`,
        component: { Text: { text: { literalString: `${indicator}${tabName}${emphasis}` } } }
      },
      {
        id: `tab_${i}_button`,
        component: {
          Button: {
            child: `tab_${i}_text`,
            action: {
              name: "viewProfile",
              contextBindings: {
                userId: { path: "/profile/userId" },
                tab: { path: `/profile/${tabKey}` }
              }
            }
          }
        }
      }
    );

    dataModel[0].valueMap.push({
      key: tabKey,
      valueString: tabName
    });
  });

  components.push(
    {
      id: "divider2",
      component: { Text: { text: { literalString: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" }, usageHint: "body" } }
    },
    {
      id: "content_title",
      component: { Text: { text: { literalString: `📄 ${activeTab} Information:` }, usageHint: "h2" } }
    }
  );

  if (tabNormal === 'overview') {
    components.push(
      { id: "overview_name", component: { Text: { text: { literalString: "📛 Name: John Anderson" }, usageHint: "h3" } } },
      { id: "overview_email", component: { Text: { text: { literalString: "📧 Email: john.anderson@company.com" }, usageHint: "body" } } },
      { id: "overview_joined", component: { Text: { text: { literalString: "📅 Member Since: January 2024" }, usageHint: "body" } } },
      { id: "overview_role", component: { Text: { text: { literalString: "👔 Role: Senior Developer" }, usageHint: "body" } } },
      { id: "overview_status", component: { Text: { text: { literalString: "✅ Account Status: Active & Verified" }, usageHint: "body" } } }
    );
  } else if (tabNormal === 'activity') {
    components.push(
      { id: "activity_title", component: { Text: { text: { literalString: "Recent Activity:" }, usageHint: "h3" } } },
      { id: "activity_1", component: { Text: { text: { literalString: "🔵 Jan 10, 10:30 AM - Logged in from Chrome on Windows" }, usageHint: "body" } } },
      { id: "activity_2", component: { Text: { text: { literalString: "🟢 Jan 9, 3:15 PM - Updated profile settings" }, usageHint: "body" } } },
      { id: "activity_3", component: { Text: { text: { literalString: "🟡 Jan 8, 11:00 AM - Changed password" }, usageHint: "body" } } },
      { id: "activity_4", component: { Text: { text: { literalString: "🔵 Jan 7, 9:45 AM - Logged in from Safari on macOS" }, usageHint: "body" } } }
    );
  } else if (tabNormal === 'settings') {
    components.push(
      { id: "settings_notifications", component: { Text: { text: { literalString: "🔔 Email Notifications: Enabled" }, usageHint: "body" } } },
      { id: "settings_privacy", component: { Text: { text: { literalString: "🔒 Profile Visibility: Friends Only" }, usageHint: "body" } } },
      { id: "settings_language", component: { Text: { text: { literalString: "🌐 Language: English (US)" }, usageHint: "body" } } },
      { id: "settings_timezone", component: { Text: { text: { literalString: "🕐 Timezone: UTC-5 (Eastern Time)" }, usageHint: "body" } } }
    );
  } else if (tabNormal === 'security') {
    components.push(
      { id: "security_password", component: { Text: { text: { literalString: "🔑 Password: Last changed 5 days ago" }, usageHint: "body" } } },
      { id: "security_2fa", component: { Text: { text: { literalString: "🛡️ Two-Factor Auth: Enabled (Authenticator App)" }, usageHint: "body" } } },
      { id: "security_sessions", component: { Text: { text: { literalString: "💻 Active Sessions: 2 devices" }, usageHint: "body" } } },
      { id: "security_devices", component: { Text: { text: { literalString: "📱 Trusted Devices: 3 registered" }, usageHint: "body" } } }
    );
  }

  return {
    data: {
      updateComponents: {
        surfaceId,
        components
      },
      updateDataModel: {
        surfaceId,
        contents: dataModel
      },
      createSurface: {
        surfaceId,
        root: rootId,
        viewportWidthPx: 800,
        viewportHeightPx: 600
      }
    },
    metadata: { mimeType: 'application/a2ui+json' }
  };
}
