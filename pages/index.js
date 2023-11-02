import React, { useState, useEffect, useRef } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";
import ThreejsOverlayView from "@ubilabs/threejs-overlay-view";
import { CatmullRomCurve3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { getGeocode, getLatLng } from "use-places-autocomplete";

const mapOptions = {
  mapId: process.env.NEXT_PUBLIC_MAP_ID,
  center: { lat: 12.856684773285444, lng: 74.85387996037798  },
  zoom: 17,
  disableDefaultUI: true,
  heading: 25,
  tilt: 60,
};

export default function App() {
  return <Wrapper apiKey={process.env.NEXT_PUBLIC_MAP_API_KEY}>
    <MyMap />
  </Wrapper>
}

function MyMap() {
  const [route, setRoute] = useState();
  const [map, setMap] = useState();
  const ref = useRef();

  useEffect(() => {
    setMap(new window.google.maps.Map(ref.current, mapOptions));
  }, []);

  

  return (
    <>
      <div ref={ref} id="map" />
      {map && <Directions setRoute={setRoute} />}
      {map && route && <Animation map={map} route={route} />}
    </>
  );
}

const ANIMATION_MS = 10000;
const FRONT_VECTOR = new Vector3(0, -1, 0);

function Animation({map, route}) {
  const overlayRef = useRef();
  const trackRef = useRef();
  const carRef = useRef();

  useEffect (() => {
    map.setCenter(route[Math.floor(route.length / 2)], 17);

    if (!overlayRef.current) {
      overlayRef.current = new ThreejsOverlayView(mapOptions.center);
      overlayRef.current.setMap(map);
    }

    const scene = overlayRef.current.getScene();
    const points = route.map((p) => overlayRef.current.latLngAltToVector3(p));
    const curve = new CatmullRomCurve3(points);


    // TRACK
    if (trackRef.current) {
      scene.remove(trackRef.current);
    }
    trackRef.current = createTrackFromCurve(curve);
    scene.add(trackRef.current);

    // CAR MODEL
    loadModel().then((model) => {
      if (carRef.current) {
        scene.remove(carRef.current);
      }
      carRef.current = model;
      scene.add(carRef.current);
    });

    overlayRef.current.update = () => {
      trackRef.current.material.resolution.copy(
        overlayRef.current.getViewportSize()
      );
      
// ANIMATION OF CAR
      if (carRef.current) {
        const progress = (performance.now() % ANIMATION_MS) / ANIMATION_MS;
        
        curve.getPointAt(progress, carRef.current.position);
        carRef.current.quaternion.setFromUnitVectors(
          FRONT_VECTOR,
          curve.getTangentAt(progress)
        );
        carRef.current.rotateX(Math.PI / 2);
      }

      overlayRef.current.requestRedraw()
    };  

    return () => {
      scene.remove(trackRef.current);
      scene.remove(carRef.current);
    };
    
  }, [route])

  return null
}

async function loadModel() {
  const loader = new GLTFLoader();
  const object = await loader.loadAsync("/man_walking/scene.gltf");
  const scene = object.scene;
  scene.scale.setScalar(0.7);

  return scene;
}

function createTrackFromCurve(curve) {
  const points = curve.getSpacedPoints(curve.points.length * 10);
  const positions = points.map((point) => point.toArray()).flat();

  return new Line2(
    new LineGeometry().setPositions(positions),
    new LineMaterial({
      color: 0xffb703,
      linewidth: 8,
    })
  );
}

function Directions({ setRoute }) {
  const [origin] = useState("Nandigudda road Mangalore India");
  const [destination] = useState("Valencia road Mangalore India");

  useEffect(() => {
    fetchDirections(origin, destination, setRoute);
  }, [origin, destination]);

  return (
    <div className="directions">
      <h2>Directions</h2>
      <h3>Origin</h3>
      <p>{origin}</p>
      <h3>Destination</h3>
      <p>{destination}</p>
    </div>
  );
}

async function fetchDirections(origin, destination, setRoute) {
  const [originResults, destinationResults] = await Promise.all([
    getGeocode({ address: origin }),
    getGeocode({ address: destination }),
  ]);

  const [originLocation, destinationLocation] = await Promise.all([
    getLatLng(originResults[0]),
    getLatLng(destinationResults[0]),
  ]);

  const service = new google.maps.DirectionsService();
  service.route(
    {
      origin: originLocation,
      destination: destinationLocation,
      travelMode: google.maps.TravelMode.DRIVING,
    },
    (result, status) => {
      if (status === "OK" && result) {
        const route = result.routes[0].overview_path.map((path) => ({
          lat: path.lat(),
          lng: path.lng(),
        }));
        setRoute(route);
      }
    }
  );
}



