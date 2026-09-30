import { useEffect, useState, useRef, useCallback } from "react";
import { Marker } from "react-map-gl/maplibre";
import { useMap } from "react-map-gl/maplibre";
import UserDot from "@/features/map/components/UserDot";

const ACCURACY_THRESHOLD = 100;
const MOVEMENT_THRESHOLD = 15;
const HIGH_ACCURACY_MAX_WAIT = 5000;
const LOW_ACCURACY_TIMEOUT = 15000;
const DEADLINE_MS = 10000;
const HIGH_ACCURACY_RETRY_MS = 30000;

const haversineDistance = ([lng1, lat1], [lng2, lat2]) => {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const LocateUser = ({
  onUserLocation,
  setIsLoading,
  disableRouting,
  enableRouting,
  followUser = true,
}) => {
  const [position, setPosition] = useState(null);
  const { current: map } = useMap();

  const onUserLocationRef = useRef(onUserLocation);
  const setIsLoadingRef = useRef(setIsLoading);
  const disableRoutingRef = useRef(disableRouting);
  const enableRoutingRef = useRef(enableRouting);
  const followUserRef = useRef(followUser);

  const firstFixRef = useRef(true);
  const watchIdRef = useRef(null);

  const deadlineTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const manualFallbackTimerRef = useRef(null);

  const lastReportedRef = useRef(null);
  const isHighAccuracyRef = useRef(true);
  const mapRef = useRef(map);

  useEffect(() => {
    onUserLocationRef.current = onUserLocation;
  }, [onUserLocation]);
  useEffect(() => {
    setIsLoadingRef.current = setIsLoading;
  }, [setIsLoading]);
  useEffect(() => {
    disableRoutingRef.current = disableRouting;
  }, [disableRouting]);
  useEffect(() => {
    enableRoutingRef.current = enableRouting;
  }, [enableRouting]);
  useEffect(() => {
    followUserRef.current = followUser;
  }, [followUser]);
  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (manualFallbackTimerRef.current) {
      clearTimeout(manualFallbackTimerRef.current);
      manualFallbackTimerRef.current = null;
    }
  }, []);

  const handlePosition = useCallback((pos) => {
    const { latitude, longitude, accuracy } = pos.coords;
    const newPos = [longitude, latitude];

    if (firstFixRef.current) {
      firstFixRef.current = false;
      clearTimeout(deadlineTimerRef.current);
      setIsLoadingRef.current(false);

      setPosition(newPos);
      lastReportedRef.current = newPos;
      onUserLocationRef.current(newPos);
      enableRoutingRef.current?.();

      mapRef.current?.flyTo({
        center: newPos,
        zoom: accuracy > 1000 ? 13 : 16,
        duration: 1000,
      });
      return;
    }

    const isLowAccuracyMode = !isHighAccuracyRef.current;
    if (!isLowAccuracyMode && accuracy > ACCURACY_THRESHOLD) {
      return;
    }

    if (manualFallbackTimerRef.current) {
      clearTimeout(manualFallbackTimerRef.current);
      manualFallbackTimerRef.current = null;
    }

    setPosition(newPos);

    const prev = lastReportedRef.current;
    const shouldNotify =
      !prev || haversineDistance(prev, newPos) > MOVEMENT_THRESHOLD;

    if (shouldNotify) {
      lastReportedRef.current = newPos;
      onUserLocationRef.current(newPos);
    }

    enableRoutingRef.current?.();

    if (followUserRef.current && shouldNotify) {
      const currentMap = mapRef.current?.getMap?.();
      if (
        currentMap &&
        !currentMap.isZooming() &&
        !currentMap.isPanning() &&
        !currentMap.isMoving()
      ) {
        currentMap.easeTo({
          center: newPos,
          duration: 1000,
        });
      }
    }
  }, []);

  const startWatching = useCallback(
    (highAccuracy) => {
      clearWatch();
      isHighAccuracyRef.current = highAccuracy;

      if (highAccuracy) {
        manualFallbackTimerRef.current = setTimeout(() => {
          // Recursive call from an async callback, after startWatching is initialized.
          // eslint-disable-next-line react-hooks/immutability
          startWatching(false);
        }, HIGH_ACCURACY_MAX_WAIT);
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        (error) => {
          if (error.code === 1 || error.code === 2) {
            if (firstFixRef.current) {
              firstFixRef.current = false;
              setIsLoadingRef.current(false);
              disableRoutingRef.current();
            }
            return;
          }

          if (highAccuracy) {
            startWatching(false);
            retryTimerRef.current = setTimeout(() => {
              startWatching(true);
            }, HIGH_ACCURACY_RETRY_MS);
          } else if (firstFixRef.current) {
            firstFixRef.current = false;
            setIsLoadingRef.current(false);
            disableRoutingRef.current();
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 10000 : LOW_ACCURACY_TIMEOUT,
          maximumAge: 0,
        },
      );
    },
    [clearWatch, handlePosition],
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      setIsLoadingRef.current(false);
      disableRoutingRef.current();
      return;
    }

    setIsLoadingRef.current(true);

    deadlineTimerRef.current = setTimeout(() => {
      if (firstFixRef.current) {
        firstFixRef.current = false;
        setIsLoadingRef.current(false);
        disableRoutingRef.current();
      }
    }, DEADLINE_MS);

    startWatching(true);

    return () => {
      clearWatch();
      if (deadlineTimerRef.current) clearTimeout(deadlineTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [clearWatch, startWatching]);

  if (!position) return null;

  return (
    <Marker longitude={position[0]} latitude={position[1]}>
      <UserDot />
    </Marker>
  );
};

export default LocateUser;
