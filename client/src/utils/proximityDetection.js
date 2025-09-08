import { Vector3 } from 'three';

export const checkProximityToDeskComputer = (userPosition, roomItems) => {
  const PROXIMITY_THRESHOLD = 2; // Distance in units to consider "near"
  
  // Find desk computer in room items
  const deskComputer = roomItems.find(item => item.name === 'deskComputer');
  
  if (!deskComputer) {
    return false;
  }

  // Calculate distance between user and desk computer
  const userVector = new Vector3(userPosition.x, userPosition.y, userPosition.z);
  const deskVector = new Vector3(deskComputer.position.x, deskComputer.position.y, deskComputer.position.z);
  
  const distance = userVector.distanceTo(deskVector);
  
  return distance <= PROXIMITY_THRESHOLD;
}; 