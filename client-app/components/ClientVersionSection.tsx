import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { versionService, VersionHistoryItem } from '@shared/services/versionService';
import { APP_VERSION } from '../constants/version';
import MaterialCommunityIcons from './icons/MaterialCommunityIcons';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';

const THROTTLE_FOCUS_CHECK_MS = 60000;

export function ClientVersionSection() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const [currentVersion] = useState<string>(APP_VERSION);
  const [latestVersion, setLatestVersion] = useState<string>(APP_VERSION);
  const [history, setHistory] = useState<VersionHistoryItem[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [blockedByLoopProtection, setBlockedByLoopProtection] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const lastCheckTimestampRef = useRef<number>(0);
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.quimicagd.com.ar';

  const checkVersion = useCallback(async (isUserInitiated = false) => {
    setIsChecking(true);
    lastCheckTimestampRef.current = Date.now();

    try {
      const data = await versionService.fetchVersionInfo(backendUrl);
      setLatestVersion(data.latest_version);
      setHistory(data.history || []);
      setLastChecked(new Date());

      const needsUpdate = versionService.isNewerOrDifferent(data.latest_version, currentVersion);
      setHasUpdate(needsUpdate);

      if (needsUpdate && Platform.OS === 'web') {
        const reloaded = await versionService.clearCacheAndReload(data.latest_version, isUserInitiated);
        if (!reloaded) {
          setBlockedByLoopProtection(true);
        } else {
          setIsReloading(true);
        }
      } else {
        versionService.cleanFlushParamIfMatched(currentVersion, data.latest_version);
        setBlockedByLoopProtection(false);
      }
    } catch (err) {
      console.warn('[ClientVersion] Error al comprobar versión:', err);
    } finally {
      setIsChecking(false);
    }
  }, [backendUrl, currentVersion]);

  const forceUpdateNow = useCallback(async () => {
    if (Platform.OS === 'web') {
      setIsReloading(true);
      await versionService.clearCacheAndReload(latestVersion, true);
    }
  }, [latestVersion]);

  useEffect(() => {
    checkVersion(false);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleFocus = () => {
        const now = Date.now();
        if (now - lastCheckTimestampRef.current > THROTTLE_FOCUS_CHECK_MS) {
          checkVersion(false);
        }
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleFocus();
        }
      });

      return () => {
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [checkVersion]);

  const isUpToDate = !hasUpdate;

  return (
    <View style={styles.container}>
      {/* Alerta si está bloqueado por protección de bucle */}
      {blockedByLoopProtection && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>
            ⚠️ <Text style={{ fontWeight: 'bold' }}>Actualización pendiente:</Text> Se detectó la versión{' '}
            <Text style={{ fontWeight: 'bold' }}>v{latestVersion}</Text>. Si observas datos desactualizados, presiona "Forzar recarga".
          </Text>
          <TouchableOpacity
            style={styles.alertBtn}
            onPress={forceUpdateNow}
            disabled={isReloading}
            activeOpacity={0.8}
          >
            <Text style={styles.alertBtnText}>{isReloading ? 'Recargando...' : 'Forzar recarga'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Barra superior de versión */}
      <View style={[styles.mainRow, isDesktop && styles.mainRowDesktop]}>
        {/* Info de versiones instalada vs servidor */}
        <View style={styles.versionBadgesGroup}>
          <View style={styles.titleWrap}>
            <MaterialCommunityIcons name="tag-outline" size={16} color="#38bdf8" />
            <Text style={styles.titleText}>Versión de la Tienda:</Text>
          </View>

          <View style={[styles.badge, isUpToDate ? styles.badgeSuccess : styles.badgeInfo]}>
            <Text style={[styles.badgeText, isUpToDate ? styles.badgeTextSuccess : styles.badgeTextInfo]}>
              Instalada: <Text style={{ fontWeight: 'bold' }}>v{currentVersion}</Text>
            </Text>
          </View>

          <View style={[styles.badge, styles.badgeServer]}>
            <Text style={[styles.badgeText, styles.badgeTextServer]}>
              Servidor: <Text style={{ fontWeight: 'bold' }}>v{latestVersion}</Text>
            </Text>
          </View>

          {isUpToDate ? (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillSuccess}>✓ Al día</Text>
            </View>
          ) : (
            <View style={styles.updateAvailableGroup}>
              <Text style={styles.statusPillWarning}>⚠️ Nueva versión disponible</Text>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={styles.updateNowBtn}
                  onPress={forceUpdateNow}
                  disabled={isReloading}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="refresh" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.updateNowBtnText}>{isReloading ? 'Actualizando...' : 'Actualizar'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Botones de acción derecha */}
        <View style={styles.actionsGroup}>
          <TouchableOpacity
            style={styles.checkBtn}
            onPress={() => checkVersion(true)}
            disabled={isChecking || isReloading}
            activeOpacity={0.7}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#94a3b8" />
            ) : (
              <MaterialCommunityIcons name="sync" size={14} color="#94a3b8" />
            )}
            <Text style={styles.checkBtnText}>{isChecking ? 'Comprobando...' : 'Comprobar'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.historyToggleBtn, isExpanded && styles.historyToggleBtnActive]}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="history"
              size={15}
              color={isExpanded ? '#38bdf8' : '#cbd5e1'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.historyToggleText, isExpanded && styles.historyToggleTextActive]}>
              Historial de cambios
            </Text>
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={isExpanded ? '#38bdf8' : '#cbd5e1'}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Historial colapsable */}
      {isExpanded && (
        <View style={styles.historyDrawer}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>🚀 Registro de Versiones del Cliente</Text>
            {lastChecked && (
              <Text style={styles.drawerTimestamp}>
                Última verificación:{' '}
                {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>

          <View style={styles.historyList}>
            {history.length === 0 ? (
              <Text style={styles.emptyHistoryText}>Cargando historial de versiones...</Text>
            ) : (
              history.map((item, index) => {
                const isItemCurrent = item.version === currentVersion;
                const isItemLatest = item.version === latestVersion;

                return (
                  <View
                    key={item.version || index}
                    style={[
                      styles.historyCard,
                      isItemCurrent && styles.historyCardCurrent,
                    ]}
                  >
                    <View style={styles.historyCardHeader}>
                      <View style={styles.versionTag}>
                        <Text style={styles.versionTagText}>v{item.version}</Text>
                      </View>
                      <Text style={styles.historyDate}>{item.fecha}</Text>

                      <View style={styles.statusBadgeAlign}>
                        {isItemCurrent ? (
                          <View style={styles.currentTag}>
                            <Text style={styles.currentTagText}>✓ Tu Versión</Text>
                          </View>
                        ) : isItemLatest ? (
                          <View style={styles.latestTag}>
                            <Text style={styles.latestTagText}>Última Servidor</Text>
                          </View>
                        ) : (
                          <Text style={styles.archivedTagText}>Archivada</Text>
                        )}
                      </View>
                    </View>

                    <Text style={styles.historyDesc}>{item.descripcion}</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Botón de forzado manual en drawer */}
          {Platform.OS === 'web' && (
            <View style={styles.drawerFooterActions}>
              <Text style={styles.drawerFooterNote}>
                💡 Al publicar una actualización, la tienda vacía automáticamente Service Workers y caché.
              </Text>
              <TouchableOpacity
                style={styles.manualCleanBtn}
                onPress={forceUpdateNow}
                disabled={isReloading}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="broom" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                <Text style={styles.manualCleanBtnText}>
                  {isReloading ? 'Vaciando caché...' : 'Limpiar caché y recargar'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0b1329',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  alertBox: {
    backgroundColor: '#78350f',
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  alertText: {
    color: '#fef3c7',
    fontSize: FontSize.xs,
    flex: 1,
  },
  alertBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  alertBtnText: {
    color: '#000000',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.xs,
  },
  mainRow: {
    flexDirection: 'column',
    gap: 12,
  },
  mainRowDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  versionBadgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 4,
  },
  titleText: {
    color: '#f1f5f9',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.xs + 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#059669',
  },
  badgeInfo: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#0284c7',
  },
  badgeServer: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: '#334155',
  },
  badgeText: {
    fontSize: FontSize.xs,
  },
  badgeTextSuccess: {
    color: '#34d399',
  },
  badgeTextInfo: {
    color: '#38bdf8',
  },
  badgeTextServer: {
    color: '#94a3b8',
  },
  statusPill: {
    marginLeft: 4,
  },
  statusPillSuccess: {
    color: '#10b981',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  updateAvailableGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPillWarning: {
    color: '#f87171',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  updateNowBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  updateNowBtnText: {
    color: '#ffffff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  checkBtnText: {
    color: '#94a3b8',
    fontSize: FontSize.xs,
  },
  historyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyToggleBtnActive: {
    backgroundColor: '#0f172a',
    borderColor: '#38bdf8',
  },
  historyToggleText: {
    color: '#cbd5e1',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  historyToggleTextActive: {
    color: '#38bdf8',
  },
  historyDrawer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  drawerTitle: {
    color: '#f8fafc',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  drawerTimestamp: {
    color: '#64748b',
    fontSize: FontSize.xs - 1,
  },
  historyList: {
    gap: 8,
  },
  emptyHistoryText: {
    color: '#64748b',
    fontSize: FontSize.xs,
    textAlign: 'center',
    paddingVertical: 12,
  },
  historyCard: {
    backgroundColor: '#1e293b',
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyCardCurrent: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  versionTag: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  versionTagText: {
    color: '#e2e8f0',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  historyDate: {
    color: '#94a3b8',
    fontSize: FontSize.xs,
  },
  statusBadgeAlign: {
    marginLeft: 'auto',
  },
  currentTag: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  currentTagText: {
    color: '#34d399',
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
  },
  latestTag: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  latestTagText: {
    color: '#93c5fd',
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
  },
  archivedTagText: {
    color: '#64748b',
    fontSize: FontSize.xs - 1,
  },
  historyDesc: {
    color: '#cbd5e1',
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  drawerFooterActions: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  drawerFooterNote: {
    color: '#64748b',
    fontSize: FontSize.xs - 1,
    flex: 1,
  },
  manualCleanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  manualCleanBtnText: {
    color: '#94a3b8',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
